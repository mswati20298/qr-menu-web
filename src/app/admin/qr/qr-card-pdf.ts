import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Restaurant } from '../../core/models/restaurant.model';
import { DEFAULT_THEME_COLOR, THEME_COLORS } from '../../core/models/theme-color.model';
import { RestaurantTable } from '../../core/models/table.model';

/**
 * Printable table cards: dark header with logo and name, "Menu & Order", a dotted QR with the logo in the middle,
 * a "scan with your phone camera" strip and a footer with the table number. Colours follow the restaurant's theme.
 * Drawn once on a canvas at print resolution, then used for the A4 PDF (QR Codes page) and the single PNG (Tables).
 */

export interface QrCardBrand {
  name: string;
  tagline?: string | null;
  /** Restaurant logo URL; without one the first letter of the name is shown. */
  logoUrl?: string | null;
  /** Theme colour (hex). The card uses a deep shade of it. */
  themeHex?: string;
}

export interface QrCardOptions {
  brand: QrCardBrand;
  /** Table labels, e.g. ['1', '2', '12', 'A3'] */
  tables: string[];
  /** Builds the URL encoded in the QR for a given table label. */
  linkFor: (table: string) => string;
}

// ---------- Restaurant -> card inputs (shared by the QR Codes and Tables pages) ----------

export function qrBrandFor(restaurant: Restaurant): QrCardBrand {
  const theme = THEME_COLORS.find((c) => c.key === restaurant.themeColor) ?? THEME_COLORS.find((c) => c.key === DEFAULT_THEME_COLOR)!;
  return { name: restaurant.name, tagline: restaurant.tagline, logoUrl: restaurant.logoUrl, themeHex: theme.hex };
}

/** The restaurant's own address (saket.qrenvo.com) when it has one, else this app's address. */
export function menuLinkFor(restaurant: Restaurant): string {
  return restaurant.subdomainsEnabled && restaurant.subdomain ? restaurant.menuUrl : `${window.location.origin}/m/${restaurant.slug}`;
}

/** ?t= table and ?k= its secret code (the menu needs both to take orders for that table). */
export function tableLinkFor(restaurant: Restaurant, table: Pick<RestaurantTable, 'number' | 'qrCode'>): string {
  const own = restaurant.subdomainsEnabled && !!restaurant.subdomain;
  const key = table.qrCode ? `&k=${encodeURIComponent(table.qrCode)}` : '';
  return `${menuLinkFor(restaurant)}${own ? '/' : ''}?t=${encodeURIComponent(table.number)}${key}`;
}

// ---------- Geometry ----------

// Card size in mm (2:3). A4 fits 2 x 2 cards with room to cut.
const CARD_W = 90;
const CARD_H = 135;
const GAP = 10;
const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 2;
const ROWS = 2;
const MARGIN_X = (PAGE_W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
const MARGIN_Y = (PAGE_H - (ROWS * CARD_H + (ROWS - 1) * GAP)) / 2;
/** Canvas pixels per mm: 300 dpi. */
const PX_PER_MM = 300 / 25.4;

const CREAM = '#F8F3E8';
const MUTED = '#5E5A4F';
const GOLD = '#C9A14A';
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Manrope', 'Segoe UI', sans-serif";

interface Palette {
  /** Header, footer, QR dots and big text. */
  deep: string;
  /** Soft tint for the scan strip. */
  tint: string;
}

function palette(themeHex = '#059669'): Palette {
  return { deep: mix(themeHex, '#000000', 0.55), tint: mix(themeHex, CREAM, 0.9) };
}

// ---------- Public builders ----------

export async function buildQrCardsPdf(opts: QrCardOptions): Promise<Blob> {
  const assets = await loadAssets(opts.brand);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < opts.tables.length; i++) {
    const slot = i % (COLS * ROWS);
    if (i > 0 && slot === 0) doc.addPage();
    const x = MARGIN_X + (slot % COLS) * (CARD_W + GAP);
    const y = MARGIN_Y + Math.floor(slot / COLS) * (CARD_H + GAP);

    const canvas = drawCard(opts.tables[i], opts.linkFor(opts.tables[i]), opts.brand, assets);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, CARD_W, CARD_H, undefined, 'FAST');
    // Faint cut line around the card.
    doc.setDrawColor('#D9D2C2');
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, CARD_W, CARD_H, 4, 4, 'S');
  }

  return doc.output('blob');
}

/** One card as a PNG, e.g. to reprint a single table. */
export async function buildQrCardPng(table: string, link: string, brand: QrCardBrand): Promise<Blob> {
  const canvas = drawCard(table, link, brand, await loadAssets(brand));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'));
}

// ---------- Drawing ----------

interface Assets {
  logo: ImageBitmap | null;
}

async function loadAssets(brand: QrCardBrand): Promise<Assets> {
  // The card uses the app fonts; wait for them so the first card is not drawn in a fallback font.
  await Promise.all(
    [`700 40px ${SERIF}`, `600 40px ${SERIF}`, `400 20px ${SANS}`, `500 20px ${SANS}`, `600 20px ${SANS}`, `700 20px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => null)
    )
  );
  return { logo: await loadLogo(brand.logoUrl) };
}

async function loadLogo(url?: string | null): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    return await createImageBitmap(await (await fetch(url)).blob());
  } catch {
    return null; // CORS / network problem -> first letter instead
  }
}

function drawCard(table: string, link: string, brand: QrCardBrand, assets: Assets): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CARD_W * PX_PER_MM);
  canvas.height = Math.round(CARD_H * PX_PER_MM);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PX_PER_MM, PX_PER_MM); // draw in mm from here on

  const p = palette(brand.themeHex);
  const W = CARD_W;
  const H = CARD_H;

  // Paper (white outside the rounded corners so the JPEG has no black corners).
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  roundRectPath(ctx, 0, 0, W, H, 4);
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  drawHeader(ctx, brand, assets, p);
  drawTitle(ctx, p);
  drawQrPanel(ctx, link, brand, assets, p, (W - 47) / 2, 55, 47);
  drawScanStrip(ctx, p, 105);
  drawFooter(ctx, table, p, 117);

  ctx.restore();
  return canvas;
}

function drawHeader(ctx: CanvasRenderingContext2D, brand: QrCardBrand, assets: Assets, p: Palette): void {
  const W = CARD_W;
  const headH = 27;
  ctx.fillStyle = p.deep;
  ctx.fillRect(0, 0, W, headH);

  // Soft leaves on the right, like a menu card.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  leaf(ctx, W - 6, 9, 13, -0.9, true);
  leaf(ctx, W - 2, 19, 11, -2.2, true);
  leaf(ctx, W - 13, 23, 8, -1.6, true);

  // Logo in a gold ring.
  const cx = 15;
  const cy = headH / 2;
  const r = 9;
  ctx.fillStyle = GOLD;
  circle(ctx, cx, cy, r + 0.9);
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, cx, cy, r + 0.3);
  drawLogo(ctx, cx, cy, r, assets.logo, brand.name, p);

  // Name, tagline and a short gold rule.
  const textX = 28.5;
  const maxW = W - textX - 6;
  const tagline = brand.tagline?.trim();
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const nameSize = fitFont(ctx, brand.name || 'Restaurant', `700 {s}px ${SERIF}`, maxW, 8.5, 4.5);
  ctx.font = `700 ${nameSize}px ${SERIF}`;
  ctx.fillText(ellipsis(ctx, brand.name || 'Restaurant', maxW), textX, tagline ? 13.5 : 16);
  if (tagline) {
    ctx.font = `400 3.1px ${SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.fillText(ellipsis(ctx, tagline, maxW), textX, 19);
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.45;
  line(ctx, textX, tagline ? 22.5 : 20, textX + 13, tagline ? 22.5 : 20);
}

function drawTitle(ctx: CanvasRenderingContext2D, p: Palette): void {
  const W = CARD_W;
  ctx.textAlign = 'center';

  // — SCAN & EXPLORE —
  ctx.font = `700 2.7px ${SANS}`;
  ctx.fillStyle = p.deep;
  const label = 'SCAN & EXPLORE';
  const labelW = spacedText(ctx, label, W / 2, 36, 0.75);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.35;
  line(ctx, W / 2 - labelW / 2 - 13, 35.1, W / 2 - labelW / 2 - 3, 35.1);
  line(ctx, W / 2 + labelW / 2 + 3, 35.1, W / 2 + labelW / 2 + 13, 35.1);

  ctx.font = `700 10px ${SERIF}`;
  ctx.fillStyle = p.deep;
  ctx.fillText('Menu & Order', W / 2, 46);

  ctx.font = `400 3.2px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('Your favourite food is just one scan away.', W / 2, 51.5);
}

function drawQrPanel(
  ctx: CanvasRenderingContext2D, link: string, brand: QrCardBrand, assets: Assets, p: Palette,
  x: number, y: number, size: number
): void {
  // White panel with a deep border and a soft shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 2.5 * PX_PER_MM; // shadows ignore the mm scale
  ctx.shadowOffsetY = 0.8 * PX_PER_MM;
  ctx.fillStyle = '#FFFFFF';
  roundRectPath(ctx, x, y, size, size, 4);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = p.deep;
  ctx.lineWidth = 0.8;
  roundRectPath(ctx, x, y, size, size, 4);
  ctx.stroke();

  const pad = 4;
  const qx = x + pad;
  const qy = y + pad;
  const qs = size - pad * 2;
  const qr = QRCode.create(link, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const cell = qs / n;
  const mid = n / 2;
  const logoCells = Math.max(3, Math.round(n * 0.11)); // ~22% of the width: safe with level H
  const inFinder = (row: number, col: number) =>
    (row < 8 && col < 8) || (row < 8 && col >= n - 8) || (row >= n - 8 && col < 8);

  // Round dots.
  ctx.fillStyle = p.deep;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col) || inFinder(row, col)) continue;
      if (Math.hypot(col + 0.5 - mid, row + 0.5 - mid) < logoCells + 0.6) continue;
      circle(ctx, qx + (col + 0.5) * cell, qy + (row + 0.5) * cell, cell * 0.46);
    }
  }

  // Rounded corner squares.
  for (const [row, col] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const fx = qx + col * cell;
    const fy = qy + row * cell;
    ctx.fillStyle = p.deep;
    roundRectPath(ctx, fx, fy, 7 * cell, 7 * cell, cell * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    roundRectPath(ctx, fx + cell, fy + cell, 5 * cell, 5 * cell, cell * 1.4);
    ctx.fill();
    ctx.fillStyle = p.deep;
    roundRectPath(ctx, fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell, cell * 0.9);
    ctx.fill();
  }

  // Logo in the middle.
  const cx = qx + qs / 2;
  const cy = qy + qs / 2;
  const r = logoCells * cell;
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, cx, cy, r + cell * 0.6);
  ctx.fillStyle = GOLD;
  circle(ctx, cx, cy, r + cell * 0.15);
  drawLogo(ctx, cx, cy, r - cell * 0.1, assets.logo, brand.name, p);
}

function drawScanStrip(ctx: CanvasRenderingContext2D, p: Palette, y: number): void {
  const x = 6;
  const w = CARD_W - 12;
  const h = 10;
  ctx.fillStyle = p.tint;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();

  // Phone icon.
  const cx = x + 5.5;
  const cy = y + h / 2;
  ctx.fillStyle = p.deep;
  circle(ctx, cx, cy, 3.9);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 0.35;
  roundRectPath(ctx, cx - 1.1, cy - 1.9, 2.2, 3.8, 0.45);
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ex = cx + sx * 2.3;
    const ey = cy + sy * 2.3;
    ctx.beginPath();
    ctx.moveTo(ex, ey - sy * 0.9);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - sx * 0.9, ey);
    ctx.stroke();
  }

  // Gold divider and the two lines of text.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.3;
  line(ctx, x + 11, y + 2.3, x + 11, y + h - 2.3);
  ctx.textAlign = 'left';
  ctx.font = `700 2.35px ${SANS}`;
  ctx.fillStyle = p.deep;
  spacedText(ctx, 'SCAN WITH YOUR PHONE CAMERA', x + 13, y + 4.3, 0.18, 'left');
  ctx.font = `400 2.3px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(ellipsis(ctx, 'Browse the menu. Choose your food. Place your order.', w - 20), x + 13, y + 7.7);

  // Arrow.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.45;
  ctx.lineCap = 'round';
  const ax = x + w - 4.5;
  line(ctx, ax - 2.6, cy, ax, cy);
  ctx.beginPath();
  ctx.moveTo(ax - 1.1, cy - 1.1);
  ctx.lineTo(ax, cy);
  ctx.lineTo(ax - 1.1, cy + 1.1);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawFooter(ctx: CanvasRenderingContext2D, table: string, p: Palette, top: number): void {
  const W = CARD_W;
  const H = CARD_H;

  // Band with a gentle wave on top.
  ctx.fillStyle = p.deep;
  ctx.beginPath();
  ctx.moveTo(0, top + 2.5);
  ctx.bezierCurveTo(W * 0.35, top + 3.2, W * 0.65, top + 1.8, W, top - 1);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Three things the menu does (true for every restaurant on QRenvo).
  const features: { draw: (cx: number, cy: number) => void; lines: [string, string] }[] = [
    { draw: (cx, cy) => chefHat(ctx, cx, cy), lines: ['Order from', 'your table'] },
    { draw: (cx, cy) => leaf(ctx, cx + 1.6, cy + 1.6, 4.4, -0.8, false), lines: ['Veg & non-veg', 'clearly marked'] },
    { draw: (cx, cy) => heart(ctx, cx, cy), lines: ['Rate your', 'meal'] }
  ];
  const colW = 19.5;
  const startX = 3;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.35;
  features.forEach((f, i) => {
    const cx = startX + colW * i + colW / 2;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.38;
    f.draw(cx, top + 6.3);
    ctx.textAlign = 'center';
    ctx.font = `500 2.15px ${SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(f.lines[0], cx, top + 12.3);
    ctx.fillText(f.lines[1], cx, top + 15);
    if (i > 0) {
      ctx.strokeStyle = 'rgba(201,161,74,0.55)';
      ctx.lineWidth = 0.25;
      line(ctx, startX + colW * i, top + 4.5, startX + colW * i, top + 14.5);
    }
  });

  // Table number in a gold frame.
  const bw = 22;
  const bh = 14.5;
  const bx = W - bw - 3.5;
  const by = top + 2.3;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.45;
  roundRectPath(ctx, bx, by, bw, bh, 3);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `700 2.3px ${SANS}`;
  ctx.fillStyle = GOLD;
  spacedText(ctx, 'TABLE', bx + bw / 2, by + 4, 0.55);
  ctx.strokeStyle = 'rgba(201,161,74,0.6)';
  ctx.lineWidth = 0.25;
  line(ctx, bx + 5, by + 5.1, bx + bw - 5, by + 5.1);
  const label = table.length === 1 ? table.padStart(2, '0') : table;
  const size = fitFont(ctx, label, `700 {s}px ${SERIF}`, bw - 3, 8.5, 4);
  ctx.font = `700 ${size}px ${SERIF}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, bx + bw / 2, by + bh - 2.2);
}

// ---------- Small drawing helpers (mm units) ----------

function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, logo: ImageBitmap | null, name: string, p: Palette): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (logo) {
    const s = Math.min(logo.width, logo.height); // cover-fit, centred
    ctx.drawImage(logo, (logo.width - s) / 2, (logo.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = p.deep;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${r * 1.15}px ${SERIF}`;
    ctx.fillText((name.trim()[0] || '?').toUpperCase(), cx, cy + r * 0.06);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** A leaf pointing along `angle`; filled (decoration) or outlined with a midrib (icon). */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, fill: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.85, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function chefHat(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - 1.8, cy + 1.2);
  ctx.arc(cx - 1.6, cy - 0.6, 1.3, Math.PI * 0.6, Math.PI * 1.6);
  ctx.arc(cx, cy - 1.4, 1.6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.arc(cx + 1.6, cy - 0.6, 1.3, Math.PI * 1.4, Math.PI * 0.4);
  ctx.lineTo(cx + 1.8, cy + 1.2);
  ctx.stroke();
  roundRectPath(ctx, cx - 1.8, cy + 1.2, 3.6, 1.6, 0.3);
  ctx.stroke();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2.2);
  ctx.bezierCurveTo(cx - 3.4, cy - 0.2, cx - 1.8, cy - 3.2, cx, cy - 1.2);
  ctx.bezierCurveTo(cx + 1.8, cy - 3.2, cx + 3.4, cy - 0.2, cx, cy + 2.2);
  ctx.stroke();
}

/** Draws text with extra letter spacing and returns its width. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'center' | 'left' = 'center'): number {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
  return total;
}

/** Largest font size (mm) between min and max at which text fits maxW. `font` has a {s} placeholder. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number, max: number, min: number): number {
  for (let s = max; s > min; s -= 0.25) {
    ctx.font = font.replace('{s}', String(s));
    if (ctx.measureText(text).width <= maxW) return s;
  }
  return min;
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Blends two hex colours: amount 0 = a, 1 = b. */
function mix(a: string, b: string, amount: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

// ---------- Table list input ----------

/** "1-5, 8, 10-12, A3" -> ['1','2','3','4','5','8','10','11','12','A3'] */
export function parseTableInput(input: string, max = 300): { tables: string[]; invalid: string[] } {
  const out: string[] = [];
  const seen = new Set<string>();
  const invalid: string[] = [];
  const add = (v: string) => {
    if (!seen.has(v) && out.length < max) {
      seen.add(v);
      out.push(v);
    }
  };
  for (const raw of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–to]+\s*(\d+)$/i.exec(raw);
    if (range) {
      let a = +range[1];
      let b = +range[2];
      if (a > b) [a, b] = [b, a];
      if (b - a > max) invalid.push(raw);
      else for (let i = a; i <= b; i++) add(String(i));
    } else if (/^[A-Za-z0-9]{1,6}$/.test(raw)) {
      add(raw);
    } else {
      invalid.push(raw);
    }
  }
  return { tables: out, invalid };
}

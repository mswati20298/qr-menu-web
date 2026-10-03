import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface QrCardBrand {
  name: string;
  tagline?: string;
  /** Optional image URL / data URL of the restaurant logo. */
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
}

export interface QrCardOptions {
  brand: QrCardBrand;
  /** Table labels, e.g. ['1', '2', '12', 'A3'] */
  tables: string[];
  /** Builds the URL encoded in the QR for a given table label. */
  linkFor: (table: string) => string;
}

const PAPER = '#FBF7EF';
const MUTED = '#6B6A60';
const RULE = '#CFC7B3';

// Card + page geometry (mm). A4 fits 2 x 2 cards.
const CARD_W = 90;
const CARD_H = 135;
const GAP = 10;
const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 2;
const ROWS = 2;
const MARGIN_X = (PAGE_W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
const MARGIN_Y = (PAGE_H - (ROWS * CARD_H + (ROWS - 1) * GAP)) / 2;

/** Loads a logo and returns it cropped to a circle as a PNG data URL (null if it can't be loaded). */
export async function loadCircularLogo(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const size = 400;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.min(bmp.width, bmp.height); // cover-fit, centred
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  } catch {
    return null; // CORS / network problem -> initial-letter fallback
  }
}

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

export async function buildQrCardsPdf(opts: QrCardOptions): Promise<Blob> {
  const primary = opts.brand.primaryColor || '#1F3D2B';
  const accent = opts.brand.accentColor || '#F2A93B';
  const logo = await loadCircularLogo(opts.brand.logoUrl);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  opts.tables.forEach((table, i) => {
    const slot = i % (COLS * ROWS);
    if (i > 0 && slot === 0) doc.addPage();
    const x = MARGIN_X + (slot % COLS) * (CARD_W + GAP);
    const y = MARGIN_Y + Math.floor(slot / COLS) * (CARD_H + GAP);
    drawCard(doc, x, y, table, opts.linkFor(table), opts.brand, logo, primary, accent);
  });

  return doc.output('blob');
}

function drawCard(
  doc: jsPDF, x: number, y: number, table: string, link: string,
  brand: QrCardBrand, logo: string | null, primary: string, accent: string
): void {
  const w = CARD_W;
  const r = 4;

  // Card body (paper) + faint cut outline
  doc.setFillColor(PAPER);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, CARD_H, r, r, 'FD');

  // Header band: rounded top only
  const headH = 26;
  doc.setFillColor(primary);
  doc.roundedRect(x, y, w, headH + r, r, r, 'F');
  doc.setFillColor(PAPER);
  doc.rect(x + 0.1, y + headH, w - 0.2, r + 0.1, 'F');

  // Logo (circle) + brand text
  drawLogo(doc, x + 8 + 7.5, y + headH / 2, 7.5, logo, brand.name, accent, primary);
  doc.setTextColor('#FFFFFF');
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  const nameX = x + 8 + 15 + 5;
  const nameMax = x + w - 6 - nameX;
  const name = fit(doc, brand.name || 'Restaurant', nameMax);
  doc.text(name, nameX, y + (brand.tagline ? 12.5 : 14.5));
  if (brand.tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#E6E2D6');
    doc.text(fit(doc, brand.tagline, nameMax), nameX, y + 18);
  }

  // Prompt
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text('Scan to see the menu and order', x + w / 2, y + 40, { align: 'center' });

  // QR panel
  const box = 60;
  const bx = x + (w - box) / 2;
  const by = y + 46;
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(primary);
  doc.setLineWidth(0.9);
  doc.roundedRect(bx, by, box, box, 5, 5, 'FD');
  drawQr(doc, link, bx + 5, by + 5, box - 10, logo, brand.name, primary, accent);

  // Divider
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1.6, 1.4], 0);
  doc.line(x + 8, y + 116, x + w - 8, y + 116);
  doc.setLineDashPattern([], 0);

  // Footer: hint left, table number right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  doc.text(['Scan with your', 'phone camera'], x + 8, y + 126);

  doc.setFont('times', 'bold');
  const numSize = table.length > 3 ? 30 : 42;
  doc.setFontSize(numSize);
  doc.setTextColor(primary);
  const numW = doc.getTextWidth(table);
  const numX = x + w - 8 - numW;
  doc.text(table, numX, y + 129);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('Table', numX - 2, y + 129, { align: 'right' });
}

function drawLogo(
  doc: jsPDF, cx: number, cy: number, rad: number, logo: string | null,
  name: string, fill: string, ink: string
): void {
  if (logo) {
    doc.addImage(logo, 'PNG', cx - rad, cy - rad, rad * 2, rad * 2);
    return;
  }
  doc.setFillColor(fill);
  doc.circle(cx, cy, rad, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(rad * 3.4);
  doc.setTextColor(ink);
  doc.text((name.trim()[0] || '?').toUpperCase(), cx, cy + rad * 0.42, { align: 'center' });
}

function drawQr(
  doc: jsPDF, text: string, x: number, y: number, size: number,
  logo: string | null, name: string, primary: string, accent: string
): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const cell = size / n;
  const c = n / 2;
  const logoR = Math.max(3, Math.round(n * 0.1)); // cells; ~20% of width, safe with level H

  const inFinder = (row: number, col: number) =>
    (row < 8 && col < 8) || (row < 8 && col >= n - 8) || (row >= n - 8 && col < 8);

  doc.setFillColor(primary);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col) || inFinder(row, col)) continue;
      if (Math.hypot(col + 0.5 - c, row + 0.5 - c) < logoR + 0.8) continue;
      const d = cell * 0.08;
      doc.roundedRect(x + col * cell + d, y + row * cell + d, cell - 2 * d, cell - 2 * d, cell * 0.3, cell * 0.3, 'F');
    }
  }

  // Rounded finder patterns
  for (const [row, col] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const fx = x + col * cell;
    const fy = y + row * cell;
    doc.setFillColor(primary);
    doc.roundedRect(fx, fy, 7 * cell, 7 * cell, cell * 2, cell * 2, 'F');
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(fx + cell, fy + cell, 5 * cell, 5 * cell, cell * 1.4, cell * 1.4, 'F');
    doc.setFillColor(primary);
    doc.roundedRect(fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell, cell, cell, 'F');
  }

  // Centre logo badge
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rad = logoR * cell;
  doc.setFillColor('#FFFFFF');
  doc.circle(cx, cy, rad + cell * 0.5, 'F');
  drawLogo(doc, cx, cy, rad, logo, name, accent, primary);
}

function fit(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

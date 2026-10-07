import { Component, OnInit, computed, signal } from '@angular/core';
import { RestaurantTable } from '../../core/models/table.model';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TableService } from '../../core/services/table.service';
import { QrCardBrand, buildQrCardsPdf, parseTableInput } from './qr-card-pdf';

@Component({
  selector: 'app-qr-page',
  templateUrl: './qr-page.html',
  styleUrl: './qr-page.scss'
})
export class QrPage implements OnInit {
  readonly slug = signal('');
  /** The restaurant's own address (https://saket.qrenvo.com) when it has one. */
  private readonly ownAddress = signal<string | null>(null);
  readonly brand = signal<QrCardBrand>({ name: '' });
  readonly tables = signal<RestaurantTable[]>([]);
  readonly copied = signal(false);
  readonly generating = signal(false);
  readonly error = signal('');

  /** Raw text typed by the user, e.g. "1-10, 15, 20-22" */
  readonly tableInput = signal('');
  readonly parsed = computed(() => parseTableInput(this.tableInput()));
  readonly pages = computed(() => Math.ceil(this.parsed().tables.length / 4)); // 4 cards per A4 page

  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly tableService: TableService
  ) {}

  ngOnInit(): void {
    this.restaurantService.get().subscribe((restaurant) => {
      this.slug.set(restaurant.slug);
      this.ownAddress.set(restaurant.subdomainsEnabled && restaurant.subdomain ? restaurant.menuUrl : null);
      // TODO: rename these fields to match your Restaurant model.
      const r = restaurant as any;
      this.brand.set({
        name: r.name ?? '',
        tagline: r.tagline ?? r.description ?? '',
        logoUrl: r.logoUrl ?? r.logo ?? null,
        primaryColor: r.primaryColor ?? undefined,
        accentColor: r.accentColor ?? undefined
      });
    });
    this.tableService.getAll().subscribe((tables) => this.tables.set(tables));
  }

  get menuLink(): string {
    // Own address first (saket.qrenvo.com). Otherwise the address the admin is using right now,
    // so QR codes made through a tunnel or a LAN IP work on phones.
    return this.ownAddress() ?? `${window.location.origin}/m/${this.slug()}`;
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.menuLink).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  onTableInput(event: Event): void {
    this.tableInput.set((event.target as HTMLInputElement).value);
  }

  /** Fill the input with every configured table. */
  useAllTables(): void {
    // TODO: rename `number` if your RestaurantTable uses another field (tableNumber, name...).
    const labels = this.tables().map((t) => String((t as any).number ?? (t as any).tableNumber ?? (t as any).name));
    this.tableInput.set(labels.join(', '));
  }

  async downloadPdf(): Promise<void> {
    const { tables } = this.parsed();
    if (tables.length === 0 || this.generating()) return;

    // A card for a table that isn't set up under Tables has no secret code, so it can only show the menu.
    const known = new Set(this.tables().map((t) => t.number));
    const missing = tables.filter((t) => !known.has(t));
    if (missing.length > 0) {
      this.error.set(`Add ${missing.length === 1 ? 'table' : 'tables'} ${missing.join(', ')} under Table Management first, so their QR codes can take orders.`);
      return;
    }

    this.generating.set(true);
    this.error.set('');
    try {
      const blob = await buildQrCardsPdf({
        brand: this.brand(),
        tables,
        // ?t= table and ?k= its secret code (the menu needs both to take orders for that table).
        linkFor: (table) => {
          const code = this.tables().find((t) => t.number === table)?.qrCode;
          const key = code ? `&k=${encodeURIComponent(code)}` : '';
          return `${this.menuLink}${this.ownAddress() ? '/' : ''}?t=${encodeURIComponent(table)}${key}`;
        }
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.slug()}-qr-cards.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.error.set('Could not generate the PDF. Please try again.');
    } finally {
      this.generating.set(false);
    }
  }
}

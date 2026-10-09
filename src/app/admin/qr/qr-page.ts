import { Component, OnInit, computed, signal } from '@angular/core';
import { Restaurant } from '../../core/models/restaurant.model';
import { RestaurantTable } from '../../core/models/table.model';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TableService } from '../../core/services/table.service';
import { buildQrCardsPdf, menuLinkFor, parseTableInput, qrBrandFor, tableLinkFor } from './qr-card-pdf';

@Component({
  selector: 'app-qr-page',
  templateUrl: './qr-page.html',
  styleUrl: './qr-page.scss'
})
export class QrPage implements OnInit {
  readonly restaurant = signal<Restaurant | null>(null);
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
    this.restaurantService.get().subscribe((restaurant) => this.restaurant.set(restaurant));
    this.tableService.getAll().subscribe((tables) => this.tables.set(tables));
  }

  get menuLink(): string {
    // Own address first (saket.qrenvo.com). Otherwise the address the admin is using right now,
    // so QR codes made through a tunnel or a LAN IP work on phones.
    const restaurant = this.restaurant();
    return restaurant ? menuLinkFor(restaurant) : '';
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
    this.tableInput.set(this.tables().map((t) => t.number).join(', '));
  }

  async downloadPdf(): Promise<void> {
    const { tables } = this.parsed();
    const restaurant = this.restaurant();
    if (tables.length === 0 || this.generating() || !restaurant) return;

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
      const byNumber = new Map(this.tables().map((t) => [t.number, t]));
      const blob = await buildQrCardsPdf({
        brand: qrBrandFor(restaurant),
        tables,
        linkFor: (table) => tableLinkFor(restaurant, byNumber.get(table)!)
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${restaurant.slug}-qr-cards.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.error.set('Could not generate the PDF. Please try again.');
    } finally {
      this.generating.set(false);
    }
  }
}

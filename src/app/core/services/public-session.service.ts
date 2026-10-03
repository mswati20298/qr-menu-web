import { Injectable, signal } from '@angular/core';
import { PublicMenuItem, PublicMenuResponse } from '../models/public-menu.model';
import { CartService } from './cart.service';
import { PublicMenuService } from './public-menu.service';

function storageKey(slug: string): string {
  return `qrmenu_table_${slug}`;
}

@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  readonly slug = signal('');
  readonly tableNumber = signal<string | null>(null);
  readonly menu = signal<PublicMenuResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  constructor(
    private readonly publicMenuService: PublicMenuService,
    private readonly cart: CartService
  ) {}

  init(slug: string, tableNumberFromUrl: string | null): void {
    if (this.slug() === slug && (this.menu() || this.loading())) {
      if (tableNumberFromUrl) {
        this.setTableNumber(slug, tableNumberFromUrl);
      }
      return;
    }

    const tableNumber = tableNumberFromUrl ?? this.readStoredTableNumber(slug);

    this.slug.set(slug);
    this.tableNumber.set(tableNumber);
    if (tableNumber) {
      this.persistTableNumber(slug, tableNumber);
    }
    this.cart.init(slug);
    this.loading.set(true);
    this.loadError.set(false);

    this.publicMenuService.getMenu(slug).subscribe({
      next: (data) => {
        this.menu.set(data);
        this.loading.set(false);
        this.publicMenuService.logScan(slug, tableNumber).subscribe();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  findItem(itemId: string): PublicMenuItem | null {
    const data = this.menu();
    if (!data) {
      return null;
    }
    for (const category of data.categories) {
      const item = category.items.find((i) => i.id === itemId);
      if (item) {
        return item;
      }
    }
    return null;
  }

  private setTableNumber(slug: string, tableNumber: string): void {
    this.tableNumber.set(tableNumber);
    this.persistTableNumber(slug, tableNumber);
  }

  private persistTableNumber(slug: string, tableNumber: string): void {
    try {
      sessionStorage.setItem(storageKey(slug), tableNumber);
    } catch {
      // sessionStorage unavailable (private browsing) — table stays in-memory for this session.
    }
  }

  private readStoredTableNumber(slug: string): string | null {
    try {
      return sessionStorage.getItem(storageKey(slug));
    } catch {
      return null;
    }
  }
}

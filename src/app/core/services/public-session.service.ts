import { Injectable, computed, signal } from '@angular/core';
import { PublicMenuItem, PublicMenuResponse, TableSession } from '../models/public-menu.model';
import { CartService } from './cart.service';
import { PublicMenuService } from './public-menu.service';

function storageKey(slug: string): string {
  return `qrmenu_table_${slug}`;
}

function sessionKey(slug: string): string {
  return `qrmenu_tsess_${slug}`;
}

/** Why this phone cannot order for a table right now (null = it can, or the restaurant doesn't need a scan). */
export type TableScanState = 'scan' | 'expired' | 'invalid' | null;

@Injectable({ providedIn: 'root' })
export class PublicSessionService {
  readonly slug = signal('');
  /** Table from the link (?t= / ?table=). With "only table QR orders" on, only a scanned session counts. */
  readonly tableNumber = signal<string | null>(null);
  readonly menu = signal<PublicMenuResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  /** Set after scanning a table QR with its secret code: lets this phone order for that table until it expires. */
  readonly tableSession = signal<TableSession | null>(null);
  private readonly scanProblem = signal<'expired' | 'invalid' | null>(null);
  /** Ticks every 30 s so an expired session is noticed while the menu stays open. */
  private readonly now = signal(Date.now());
  private clock: ReturnType<typeof setInterval> | null = null;

  readonly hasValidSession = computed(() => {
    const s = this.tableSession();
    return !!s && Date.parse(s.expiresAt) > this.now();
  });

  private readonly requiresTableQr = computed(() => this.menu()?.restaurant.requireTableQr ?? false);

  /** The table an order or request is placed for (null = takeaway). */
  readonly orderTable = computed(() => {
    if (this.hasValidSession()) {
      return this.tableSession()!.tableNumber;
    }
    return this.requiresTableQr() ? null : this.tableNumber();
  });

  /** False when this phone may not order at all from here (needs a table scan and takeaway is off). */
  readonly canOrderHere = computed(() => !!this.orderTable() || (this.menu()?.restaurant.allowLinkTakeaway ?? true));

  readonly scanState = computed<TableScanState>(() => {
    if (!this.requiresTableQr() || this.hasValidSession()) {
      return null;
    }
    if (this.scanProblem()) {
      return this.scanProblem();
    }
    return this.tableSession() ? 'expired' : 'scan';
  });

  constructor(
    private readonly publicMenuService: PublicMenuService,
    private readonly cart: CartService
  ) {}

  init(slug: string, tableNumberFromUrl: string | null, codeFromUrl: string | null = null): void {
    this.clock ??= setInterval(() => this.now.set(Date.now()), 30000);

    if (this.slug() === slug && (this.menu() || this.loading())) {
      if (tableNumberFromUrl) {
        this.setTableNumber(slug, tableNumberFromUrl);
      }
      if (tableNumberFromUrl && codeFromUrl) {
        this.startSession(slug, tableNumberFromUrl, codeFromUrl);
      }
      return;
    }

    const tableNumber = tableNumberFromUrl ?? this.readStoredTableNumber(slug);

    this.slug.set(slug);
    this.tableNumber.set(tableNumber);
    this.scanProblem.set(null);
    this.tableSession.set(this.readStoredSession(slug));
    if (tableNumber) {
      this.persistTableNumber(slug, tableNumber);
    }
    if (tableNumberFromUrl && codeFromUrl) {
      this.startSession(slug, tableNumberFromUrl, codeFromUrl);
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

  /** The server said the session is no longer good (expired or the table's code was reset). */
  endSession(): void {
    this.tableSession.set(null);
    this.scanProblem.set('expired');
    try {
      localStorage.removeItem(sessionKey(this.slug()));
    } catch {
      // ignore
    }
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

  private startSession(slug: string, table: string, code: string): void {
    this.publicMenuService.startTableSession(slug, table, code).subscribe({
      next: (session) => {
        this.scanProblem.set(null);
        this.now.set(Date.now());
        this.tableSession.set(session);
        this.setTableNumber(slug, session.tableNumber);
        try {
          localStorage.setItem(sessionKey(slug), JSON.stringify(session));
        } catch {
          // Storage unavailable: the session lasts until the page is closed.
        }
      },
      error: () => this.scanProblem.set('invalid')
    });
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

  private readStoredSession(slug: string): TableSession | null {
    try {
      const raw = localStorage.getItem(sessionKey(slug));
      return raw ? (JSON.parse(raw) as TableSession) : null;
    } catch {
      return null;
    }
  }
}

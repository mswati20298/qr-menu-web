import { Injectable, computed, signal } from '@angular/core';
import { CartLine, CartLineAddOn } from '../models/cart.model';

function buildLineId(itemId: string, variantId: string | null, addOns: CartLineAddOn[]): string {
  const addOnKey = addOns.map((a) => a.id).sort().join(',');
  return `${itemId}::${variantId ?? 'default'}::${addOnKey}`;
}

function isValidCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const line = value as Partial<CartLine>;
  return (
    typeof line.lineId === 'string' &&
    typeof line.itemId === 'string' &&
    typeof line.name === 'string' &&
    typeof line.unitPrice === 'number' &&
    typeof line.qty === 'number' &&
    Array.isArray(line.addOns)
  );
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private slug = '';
  private readonly lines = signal<CartLine[]>([]);

  readonly items = computed(() => this.lines());
  readonly itemCount = computed(() => this.lines().reduce((sum, line) => sum + line.qty, 0));
  readonly subtotal = computed(() =>
    this.lines().reduce((sum, line) => sum + this.lineTotal(line), 0)
  );

  init(slug: string): void {
    this.slug = slug;
    this.lines.set(this.readFromStorage());
  }

  lineTotal(line: CartLine): number {
    const addOnsTotal = line.addOns.reduce((sum, a) => sum + a.price, 0);
    return (line.unitPrice + addOnsTotal) * line.qty;
  }

  /** Quantity of the plain (no size/add-ons) line for an item — used by the quick "Add +"
   * control on the menu list for items that don't require customization. */
  getSimpleQty(itemId: string): number {
    const line = this.lines().find((l) => l.itemId === itemId && l.variantId === null && l.addOns.length === 0);
    return line?.qty ?? 0;
  }

  quickAdd(itemId: string, name: string, imageUrl: string | null, unitPrice: number): void {
    this.add(itemId, name, imageUrl, null, null, unitPrice, [], 1);
  }

  quickIncrement(itemId: string): void {
    this.increment(buildLineId(itemId, null, []));
  }

  quickDecrement(itemId: string): void {
    this.decrement(buildLineId(itemId, null, []));
  }

  add(
    itemId: string,
    name: string,
    imageUrl: string | null,
    variantId: string | null,
    variantName: string | null,
    unitPrice: number,
    addOns: CartLineAddOn[],
    qty: number
  ): void {
    const lineId = buildLineId(itemId, variantId, addOns);
    const current = this.lines();
    const existing = current.find((l) => l.lineId === lineId);

    if (existing) {
      this.setLines(current.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + qty } : l)));
    } else {
      this.setLines([
        ...current,
        { lineId, itemId, name, imageUrl, variantId, variantName, addOns, unitPrice, qty }
      ]);
    }
  }

  increment(lineId: string): void {
    this.setLines(this.lines().map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l)));
  }

  decrement(lineId: string): void {
    const current = this.lines();
    const existing = current.find((l) => l.lineId === lineId);
    if (!existing) {
      return;
    }

    if (existing.qty <= 1) {
      this.setLines(current.filter((l) => l.lineId !== lineId));
    } else {
      this.setLines(current.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l)));
    }
  }

  remove(lineId: string): void {
    this.setLines(this.lines().filter((l) => l.lineId !== lineId));
  }

  /** Re-inserts a line removed via `remove`, at its original position — used for the
   * "undo" toast when a stepper decrement takes a line's quantity to zero. */
  restoreLine(line: CartLine, index: number): void {
    const current = this.lines();
    if (current.some((l) => l.lineId === line.lineId)) {
      return;
    }
    const next = [...current];
    next.splice(Math.min(index, next.length), 0, line);
    this.setLines(next);
  }

  clear(): void {
    this.setLines([]);
  }

  private setLines(lines: CartLine[]): void {
    this.lines.set(lines);
    this.writeToStorage(lines);
  }

  private storageKey(): string {
    return `qrmenu_cart_${this.slug}`;
  }

  private readFromStorage(): CartLine[] {
    if (!this.slug) {
      return [];
    }
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isValidCartLine) : [];
    } catch {
      return [];
    }
  }

  private writeToStorage(lines: CartLine[]): void {
    if (!this.slug) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(lines));
    } catch {
      // localStorage unavailable (private browsing) — cart stays in-memory for this session.
    }
  }
}

import { DecimalPipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Category } from '../../core/models/category.model';
import { MenuItem } from '../../core/models/item.model';
import { OrderItemInput, StaffOrderRequest, StaffPaymentMethod } from '../../core/models/order.model';
import { Restaurant } from '../../core/models/restaurant.model';
import { RestaurantTable } from '../../core/models/table.model';
import { computeBill } from '../../core/services/billing.util';
import { CategoryService } from '../../core/services/category.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { ItemService } from '../../core/services/item.service';
import { OrderService } from '../../core/services/order.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TableService } from '../../core/services/table.service';
import { VegBadge } from '../../shared/veg-badge/veg-badge';

interface BillLine {
  /** Same dish + size + add-ons = one line. */
  key: string;
  itemId: string;
  name: string;
  isVeg: boolean;
  variantId: string | null;
  variantName: string | null;
  addOns: { id: string; name: string; price: number }[];
  unitPrice: number;
  qty: number;
}

interface Picker {
  item: MenuItem;
  variantId: string | null;
  addOnIds: Set<string>;
  qty: number;
}

const PAYMENT_OPTIONS: { value: StaffPaymentMethod | null; label: string }[] = [
  { value: null, label: 'Unpaid' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Upi', label: 'UPI' },
  { value: 'Card', label: 'Card' }
];

/**
 * Counter billing: staff picks dishes from the menu for a walk-in, phone or takeaway order (or adds to a
 * table) and prints the bill. Prices, sizes, add-ons, GST and service charge follow the same rules as a guest order.
 */
@Component({
  selector: 'app-new-bill-page',
  imports: [DecimalPipe, RouterLink, VegBadge],
  templateUrl: './new-bill-page.html',
  styleUrl: './new-bill-page.scss'
})
export class NewBillPage implements OnInit {
  private readonly itemService = inject(ItemService);
  private readonly categoryService = inject(CategoryService);
  private readonly tableService = inject(TableService);
  private readonly restaurantService = inject(RestaurantService);
  private readonly orderService = inject(OrderService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly paymentOptions = PAYMENT_OPTIONS;

  readonly loading = signal(true);
  readonly items = signal<MenuItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly restaurant = signal<Restaurant | null>(null);

  readonly search = signal('');
  readonly activeCategory = signal<string | null>(null);

  readonly lines = signal<BillLine[]>([]);
  readonly table = signal('');
  readonly customerName = signal('');
  readonly customerPhone = signal('');
  readonly note = signal('');
  readonly skipServiceCharge = signal(false);
  readonly sendToKitchen = signal(true);
  readonly paidWith = signal<StaffPaymentMethod | null>(null);

  readonly picker = signal<Picker | null>(null);
  readonly submitting = signal<'bill' | 'order' | null>(null);

  /** Categories in menu order, each with its dishes matching the search. */
  readonly sections = computed(() => {
    const term = this.search().trim().toLowerCase();
    const active = this.activeCategory();
    const items = this.items().filter((i) => !term || i.name.toLowerCase().includes(term));
    return this.categories()
      .filter((c) => !active || c.id === active)
      .map((c) => ({ category: c, items: items.filter((i) => i.categoryId === c.id) }))
      .filter((s) => s.items.length > 0);
  });

  readonly itemCount = computed(() => this.lines().reduce((sum, l) => sum + l.qty, 0));

  readonly bill = computed(() => {
    const subtotal = this.lines().reduce((sum, l) => sum + this.lineTotal(l), 0);
    const restaurant = this.restaurant();
    return restaurant
      ? computeBill(subtotal, restaurant, this.skipServiceCharge())
      : { subtotal, serviceChargeAmount: 0, gstAmount: 0, total: subtotal };
  });

  readonly phoneInvalid = computed(() => {
    const phone = this.customerPhone().trim();
    return phone !== '' && !/^\+?[0-9]{10,15}$/.test(phone);
  });

  ngOnInit(): void {
    // /admin/invoices/new?table=5 starts with that table selected (from the Orders page).
    this.table.set(this.route.snapshot.queryParamMap.get('table') ?? '');

    forkJoin({
      items: this.itemService.getAll(),
      categories: this.categoryService.getAll(),
      tables: this.tableService.getAll(),
      restaurant: this.restaurantService.get()
    }).subscribe({
      next: ({ items, categories, tables, restaurant }) => {
        this.items.set(items);
        this.categories.set([...categories].sort((a, b) => a.sortOrder - b.sortOrder));
        this.tables.set(tables.filter((t) => t.isActive));
        this.restaurant.set(restaurant);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.feedback.error('Could not load the menu. Please refresh the page.');
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.picker.set(null);
  }

  priceLabel(item: MenuItem): string {
    if (item.variants.length > 0) {
      return `From ₹${Math.min(...item.variants.map((v) => v.price))}`;
    }
    return `₹${item.price}`;
  }

  qtyInBill(itemId: string): number {
    return this.lines().filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0);
  }

  /** Plain dish: one tap adds it. Dish with sizes or add-ons: open the options box. */
  pick(item: MenuItem): void {
    if (!item.isAvailable) {
      return;
    }
    if (item.variants.length === 0 && item.addOns.length === 0) {
      this.addLine(item, null, [], 1);
      return;
    }
    const size = item.variants.find((v) => v.isDefault) ?? item.variants[0] ?? null;
    this.picker.set({ item, variantId: size?.id ?? null, addOnIds: new Set(), qty: 1 });
  }

  pickerPrice(p: Picker): number {
    const base = p.item.variants.find((v) => v.id === p.variantId)?.price ?? p.item.price;
    const addOns = p.item.addOns.filter((a) => p.addOnIds.has(a.id)).reduce((sum, a) => sum + a.price, 0);
    return (base + addOns) * p.qty;
  }

  setPickerVariant(id: string): void {
    const p = this.picker();
    if (p) this.picker.set({ ...p, variantId: id });
  }

  togglePickerAddOn(id: string): void {
    const p = this.picker();
    if (!p) return;
    const next = new Set(p.addOnIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.picker.set({ ...p, addOnIds: next });
  }

  setPickerQty(delta: number): void {
    const p = this.picker();
    if (p) this.picker.set({ ...p, qty: Math.min(50, Math.max(1, p.qty + delta)) });
  }

  confirmPicker(): void {
    const p = this.picker();
    if (!p) return;
    const variant = p.item.variants.find((v) => v.id === p.variantId) ?? null;
    const addOns = p.item.addOns.filter((a) => p.addOnIds.has(a.id)).map((a) => ({ id: a.id, name: a.name, price: a.price }));
    this.addLine(p.item, variant ? { id: variant.id, name: variant.name, price: variant.price } : null, addOns, p.qty);
    this.picker.set(null);
  }

  changeQty(line: BillLine, delta: number): void {
    const qty = line.qty + delta;
    this.lines.set(
      qty <= 0
        ? this.lines().filter((l) => l.key !== line.key)
        : this.lines().map((l) => (l.key === line.key ? { ...l, qty: Math.min(50, qty) } : l))
    );
  }

  removeLine(line: BillLine): void {
    this.lines.set(this.lines().filter((l) => l.key !== line.key));
  }

  lineTotal(line: BillLine): number {
    return (line.unitPrice + line.addOns.reduce((sum, a) => sum + a.price, 0)) * line.qty;
  }

  addOnNames(line: BillLine): string {
    return line.addOns.map((a) => a.name).join(', ');
  }

  async clear(): Promise<void> {
    if (this.lines().length === 0) return;
    const confirmed = await this.feedback.confirm({
      title: 'Clear this bill?',
      message: 'All items you added are removed.',
      confirmLabel: 'Clear bill',
      danger: true
    });
    if (confirmed) {
      this.resetBill(false);
    }
  }

  /** Order only: goes on the table (and to the kitchen); bill it later with "Bill whole table". */
  addToTable(): void {
    if (!this.canSubmit() || !this.table()) return;
    this.submitting.set('order');
    this.orderService.createStaffOrder(this.request()).subscribe({
      next: () => {
        this.submitting.set(null);
        this.feedback.success(`Added to Table ${this.table()}${this.sendToKitchen() ? ' and sent to the kitchen' : ''}.`);
        this.resetBill(true);
      },
      error: (err) => this.failed(err, 'Could not add the order.')
    });
  }

  /** Order + invoice in one go, then straight to the invoice to print it. */
  createBill(): void {
    if (!this.canSubmit()) return;
    this.submitting.set('bill');
    this.invoiceService.createManual({ ...this.request(), paidWith: this.paidWith() }).subscribe({
      next: (invoice) => {
        this.submitting.set(null);
        this.feedback.success(`Bill ${invoice.number} created.`);
        this.router.navigate(['/admin/invoices'], { queryParams: { open: invoice.id } });
      },
      error: (err) => this.failed(err, 'Could not create the bill.')
    });
  }

  private canSubmit(): boolean {
    if (this.lines().length === 0) {
      this.feedback.error('Add at least one item.');
      return false;
    }
    if (this.phoneInvalid()) {
      this.feedback.error('Enter a valid phone number, or leave it empty.');
      return false;
    }
    return this.submitting() === null;
  }

  private request(): StaffOrderRequest {
    const items: OrderItemInput[] = this.lines().map((l) => ({
      menuItemId: l.itemId,
      variantId: l.variantId,
      addOnIds: l.addOns.map((a) => a.id),
      qty: l.qty
    }));
    return {
      tableNumber: this.table() || null,
      customerName: this.customerName().trim() || null,
      customerPhone: this.customerPhone().trim() || null,
      note: this.note().trim() || null,
      skipServiceCharge: this.skipServiceCharge(),
      sendToKitchen: this.sendToKitchen(),
      items
    };
  }

  private failed(err: { error?: { errors?: string[]; message?: string } }, fallback: string): void {
    this.submitting.set(null);
    this.feedback.error(err?.error?.errors?.[0] ?? err?.error?.message ?? fallback);
  }

  private addLine(
    item: MenuItem,
    variant: { id: string; name: string; price: number } | null,
    addOns: { id: string; name: string; price: number }[],
    qty: number
  ): void {
    const key = `${item.id}|${variant?.id ?? ''}|${addOns.map((a) => a.id).sort().join(',')}`;
    const existing = this.lines().find((l) => l.key === key);
    if (existing) {
      this.lines.set(this.lines().map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + qty) } : l)));
      return;
    }
    this.lines.set([
      ...this.lines(),
      {
        key,
        itemId: item.id,
        name: item.name,
        isVeg: item.isVeg,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        addOns,
        unitPrice: variant?.price ?? item.price,
        qty
      }
    ]);
  }

  private resetBill(keepTable: boolean): void {
    this.lines.set([]);
    this.note.set('');
    this.paidWith.set(null);
    if (!keepTable) {
      this.table.set('');
      this.customerName.set('');
      this.customerPhone.set('');
    }
  }
}

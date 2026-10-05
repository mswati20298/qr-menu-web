import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartLine } from '../../core/models/cart.model';
import { OrderItemInput } from '../../core/models/order.model';
import { CartService } from '../../core/services/cart.service';
import { computeBill } from '../../core/services/billing.util';
import { CustomerProfileService } from '../../core/services/customer-profile.service';
import { OrderService } from '../../core/services/order.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { BillSummary } from '../components/bill-summary/bill-summary';

interface RemovedLine {
  line: CartLine;
  index: number;
  handle: ReturnType<typeof setTimeout>;
}

@Component({
  selector: 'app-cart-tab',
  imports: [ReactiveFormsModule, BillSummary],
  templateUrl: './cart-tab.html',
  styleUrl: './cart-tab.scss'
})
export class CartTab {
  private readonly fb = inject(FormBuilder);
  readonly session = inject(PublicSessionService);
  readonly cart = inject(CartService);
  private readonly orderService = inject(OrderService);
  readonly profileService = inject(CustomerProfileService);
  readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  readonly placingOrder = signal(false);
  readonly editingDetails = signal(false);
  readonly showNoteField = signal(false);
  readonly note = signal('');
  readonly skipServiceCharge = signal(false);
  readonly removedLine = signal<RemovedLine | null>(null);

  readonly hasSavedProfile = computed(() => {
    const p = this.profileService.current();
    return !!(p.name && p.phone);
  });

  readonly bill = computed(() => {
    const restaurant = this.session.menu()?.restaurant;
    if (!restaurant) {
      return { subtotal: this.cart.subtotal(), serviceChargeAmount: 0, gstAmount: 0, total: this.cart.subtotal() };
    }
    return computeBill(this.cart.subtotal(), restaurant, this.skipServiceCharge());
  });

  addOnNames(addOns: { name: string }[]): string {
    return addOns.map((a) => a.name).join(', ');
  }

  readonly checkoutForm = this.fb.group({
    name: this.fb.control(this.profileService.current().name, [Validators.required]),
    phone: this.fb.control(this.profileService.current().phone, [Validators.required, Validators.pattern(/^[0-9]{10}$/)])
  });

  tableLabel(): string {
    return this.session.tableNumber() ? `Table ${this.session.tableNumber()}` : 'Takeaway';
  }

  decrementLine(line: CartLine): void {
    if (line.qty <= 1) {
      this.removeLine(line);
    } else {
      this.cart.decrement(line.lineId);
    }
  }

  private removeLine(line: CartLine): void {
    const index = this.cart.items().findIndex((l) => l.lineId === line.lineId);
    this.cart.remove(line.lineId);

    const pending = this.removedLine();
    if (pending) {
      clearTimeout(pending.handle);
    }
    const handle = setTimeout(() => this.removedLine.set(null), 5000);
    this.removedLine.set({ line, index, handle });
  }

  undoRemove(): void {
    const pending = this.removedLine();
    if (!pending) {
      return;
    }
    clearTimeout(pending.handle);
    this.removedLine.set(null);
    this.cart.restoreLine(pending.line, pending.index);
  }

  startEditDetails(): void {
    const current = this.profileService.current();
    this.checkoutForm.patchValue({ name: current.name, phone: current.phone });
    this.editingDetails.set(true);
  }

  /** False when the restaurant's plan has run out. */
  readonly orderingEnabled = computed(() => this.session.menu()?.restaurant?.orderingEnabled ?? true);

  placeOrder(): void {
    if (!this.orderingEnabled()) {
      return;
    }
    if (!this.hasSavedProfile() || this.editingDetails()) {
      if (this.checkoutForm.invalid) {
        this.checkoutForm.markAllAsTouched();
        return;
      }
    }

    const value = this.checkoutForm.getRawValue();
    const name = value.name!.trim();
    const phone = value.phone!.trim();
    if (!name || !phone) {
      this.editingDetails.set(true);
      this.checkoutForm.markAllAsTouched();
      return;
    }
    this.profileService.save({ name, phone });
    this.editingDetails.set(false);

    const items: OrderItemInput[] = this.cart.items().map((line) => ({
      menuItemId: line.itemId,
      variantId: line.variantId,
      addOnIds: line.addOns.map((a) => a.id),
      qty: line.qty
    }));

    this.placingOrder.set(true);

    this.orderService
      .createOrder(this.session.slug(), {
        tableNumber: this.session.tableNumber(),
        customerName: name,
        customerPhone: phone,
        note: this.note().trim() || null,
        skipServiceCharge: this.skipServiceCharge(),
        items
      })
      .subscribe({
        next: (order) => {
          this.cart.clear();
          this.placingOrder.set(false);
          this.feedback.success('Order placed. The kitchen has it.');
          this.router.navigate(['/m', this.session.slug(), 'order', order.id]);
        },
        error: (err) => {
          this.placingOrder.set(false);
          this.feedback.error(err?.error?.message ?? 'Could not place your order. Please try again.');
        }
      });
  }
}

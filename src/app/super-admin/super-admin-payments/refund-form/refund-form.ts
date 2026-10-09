import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

export interface RefundFormValue {
  /** null = the whole amount that is left. */
  amount: number | null;
  note: string | null;
  includeFee: boolean;
}

/**
 * Amount + note for a refund. Used to approve an owner's request and to refund a payment directly.
 * Leaves the API call to the parent so both places share one form and one set of checks.
 */
@Component({
  selector: 'app-refund-form',
  imports: [FormsModule, InrPipe],
  templateUrl: './refund-form.html',
  styleUrl: './refund-form.scss'
})
export class RefundForm {
  /** Most that can still go back, after Razorpay's charges (rupees). */
  readonly maxAmount = input.required<number>();
  /** Razorpay's charges on the payment; they are kept back unless includeFee is ticked. */
  readonly fee = input(0);
  readonly online = input(true);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitLabel = input('Refund');

  readonly submitted = output<RefundFormValue>();
  readonly cancelled = output<void>();

  readonly amount = signal<number | null>(null);
  readonly note = signal('');
  readonly localError = signal<string | null>(null);
  /** Give the charges back too: only for a double charge or our mistake (we then bear them). */
  readonly includeFee = signal(false);

  readonly limit = computed(() => Math.round((this.maxAmount() + (this.includeFee() ? this.fee() : 0)) * 100) / 100);

  readonly isFull = computed(() => {
    const value = this.amount();
    return value === null || value >= this.limit();
  });

  submit(): void {
    const value = this.amount();
    if (value !== null && (!(value > 0) || value > this.limit())) {
      this.localError.set(`Enter an amount between ₹1 and ₹${this.limit()}.`);
      return;
    }
    if (!this.online() && !this.note().trim()) {
      this.localError.set('Add how you sent the money back (e.g. UPI reference).');
      return;
    }
    this.localError.set(null);
    this.submitted.emit({ amount: this.isFull() ? null : value, note: this.note().trim() || null, includeFee: this.includeFee() });
  }
}

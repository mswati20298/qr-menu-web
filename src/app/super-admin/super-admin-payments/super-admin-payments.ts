import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { PaymentGatewayLogEntry, PaymentLog, PaymentLogEntry } from '../../core/models/super-admin.model';
import { FeedbackService } from '../../core/services/feedback.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { REFUND_STATUS_LABELS } from '../../core/models/refund.model';
import { errorMessage } from '../../core/utils/http-error';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { RefundForm, RefundFormValue } from './refund-form/refund-form';
import { RefundList } from './refund-list/refund-list';

type StatusFilter = '' | 'paid' | 'unpaid' | 'refunds';

/**
 * Every plan payment: Razorpay checkouts (paid, or opened and left) and payments recorded by hand.
 * Super admin only; owners see just their own history on "My plan".
 */
@Component({
  selector: 'app-super-admin-payments',
  imports: [DatePipe, InrPipe, RefundForm, RefundList],
  templateUrl: './super-admin-payments.html',
  styleUrl: './super-admin-payments.scss'
})
export class SuperAdminPayments implements OnInit, OnDestroy {
  private readonly service = inject(SuperAdminService);
  private readonly toast = inject(FeedbackService);

  readonly log = signal<PaymentLog | null>(null);
  readonly loading = signal(true);
  readonly status = signal<StatusFilter>('');
  readonly expandedId = signal<string | null>(null);
  /** Razorpay messages for opened rows, keyed by order id (loaded when the row opens). */
  readonly gatewayLog = signal<Record<string, PaymentGatewayLogEntry[] | 'loading' | 'error'>>({});
  /** Which bodies are unfolded: "<index>:req" or "<index>:res". */
  readonly openBodies = signal<Set<string>>(new Set());
  /** Payment whose refund form is open. */
  readonly refundingId = signal<string | null>(null);
  readonly refundBusy = signal(false);
  readonly refundError = signal<string | null>(null);
  readonly refundLabels = REFUND_STATUS_LABELS;

  private search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  setStatus(status: StatusFilter): void {
    this.status.set(status);
    if (status !== 'refunds') {
      this.load();
    }
  }

  /** What can still go back for this payment, after Razorpay's charges. */
  refundable(p: PaymentLogEntry): number {
    return Math.max(0, Math.round((p.amount - (p.refundFee ?? 0) - (p.refundedAmount ?? 0)) * 100) / 100);
  }

  openRefund(p: PaymentLogEntry, event: Event): void {
    event.stopPropagation();
    this.refundingId.set(p.id);
    this.refundError.set(null);
  }

  closeRefund(): void {
    if (!this.refundBusy()) {
      this.refundingId.set(null);
    }
  }

  async refund(p: PaymentLogEntry, value: RefundFormValue): Promise<void> {
    const amount = value.amount ?? this.refundable(p) + (value.includeFee ? p.refundFee : 0);
    const full = value.amount === null;
    const ok = await this.toast.confirm({
      title: `Refund ₹${amount} to ${p.restaurantName}?`,
      message: (p.source === 'online' ? 'Razorpay sends the money back to the account they paid from. ' : 'This only records a refund you made yourself. ')
        + (full ? 'Their plan stops at once.' : 'Their plan keeps running.'),
      confirmLabel: 'Refund',
      danger: true
    });
    if (!ok) {
      return;
    }
    this.refundBusy.set(true);
    this.refundError.set(null);
    this.service.refundPayment({
      planPaymentId: p.source === 'online' ? p.id : null,
      paymentEventId: p.source === 'manual' ? p.id : null,
      amount: value.amount,
      note: value.note,
      includeFee: value.includeFee
    }).subscribe({
      next: (done) => {
        this.refundBusy.set(false);
        this.refundingId.set(null);
        this.toast.success(done.status === 'Refunded' ? 'Refunded.' : 'Refund started. Razorpay will confirm it shortly.');
        this.load();
      },
      error: (err) => {
        this.refundBusy.set(false);
        this.refundError.set(errorMessage(err, 'Could not refund. Please try again.'));
      }
    });
  }

  onSearch(value: string): void {
    this.search = value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  toggle(entry: PaymentLogEntry): void {
    const opening = this.expandedId() !== entry.id;
    this.expandedId.set(opening ? entry.id : null);
    this.openBodies.set(new Set());
    const orderId = entry.gatewayOrderId;
    if (opening && orderId && !Array.isArray(this.gatewayLog()[orderId])) {
      this.gatewayLog.set({ ...this.gatewayLog(), [orderId]: 'loading' });
      this.service.gatewayLog(orderId).subscribe({
        next: (items) => this.gatewayLog.set({ ...this.gatewayLog(), [orderId]: items }),
        error: () => this.gatewayLog.set({ ...this.gatewayLog(), [orderId]: 'error' })
      });
    }
  }

  logState(orderId: string | null): 'loading' | 'error' | 'ready' | null {
    const value = orderId ? this.gatewayLog()[orderId] : undefined;
    return value === undefined ? null : Array.isArray(value) ? 'ready' : value;
  }

  entries(orderId: string | null): PaymentGatewayLogEntry[] {
    const value = orderId ? this.gatewayLog()[orderId] : undefined;
    return Array.isArray(value) ? value : [];
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'order.create':
        return 'Order created on Razorpay';
      case 'checkout.confirm':
        return 'Confirmation from the browser';
      case 'webhook':
        return 'Webhook from Razorpay';
      case 'result':
        return 'Result';
      case 'refund.create':
        return 'Refund sent to Razorpay';
      default:
        return kind;
    }
  }

  toggleBody(key: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.openBodies());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.openBodies.set(next);
  }

  /** Raw JSON, indented for reading (left as it is when it is not JSON). */
  pretty(body: string | null): string {
    if (!body) {
      return '';
    }
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  methodLabel(method: string | null): string {
    switch (method) {
      case 'Upi':
        return 'UPI';
      case 'BankTransfer':
        return 'Bank transfer';
      case null:
        return '—';
      default:
        return method;
    }
  }

  async copy(text: string | null): Promise<void> {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Copied.');
    } catch {
      this.toast.info(text);
    }
  }

  load(): void {
    this.loading.set(true);
    const status = this.status();
    this.service.payments(status === 'refunds' ? '' : status, this.search).subscribe({
      next: (log) => {
        this.log.set(log);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load the payments.');
      }
    });
  }
}

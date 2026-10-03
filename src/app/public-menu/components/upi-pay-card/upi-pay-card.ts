import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import QRCode from 'qrcode';
import { Order } from '../../../core/models/order.model';
import { OrderService } from '../../../core/services/order.service';

/**
 * Lets the customer pay an order straight into the restaurant's own UPI account: a QR with the amount
 * filled in, an "open UPI app" button and the UPI ID to copy. The app cannot see the bank, so after paying
 * the customer taps "I've paid" and staff confirm it on the Orders page.
 */
@Component({
  selector: 'app-upi-pay-card',
  templateUrl: './upi-pay-card.html',
  styleUrl: './upi-pay-card.scss'
})
export class UpiPayCard {
  private readonly orderService = inject(OrderService);

  readonly order = input.required<Order>();
  readonly slug = input.required<string>();
  readonly upiId = input.required<string>();
  readonly payeeName = input.required<string>();

  readonly updated = output<Order>();

  readonly qrDataUrl = signal<string | null>(null);
  readonly copied = signal(false);
  readonly askReference = signal(false);
  readonly reference = signal('');
  readonly claiming = signal(false);
  readonly error = signal<string | null>(null);

  /** Standard UPI deep link; every UPI app (GPay, PhonePe, Paytm, BHIM…) understands it. */
  readonly upiLink = computed(() => {
    const order = this.order();
    const params = new URLSearchParams({
      pa: this.upiId(),
      pn: this.payeeName(),
      am: order.total.toFixed(2),
      cu: 'INR',
      tn: `Order ${order.id.slice(0, 8).toUpperCase()}`
    });
    return `upi://pay?${params.toString()}`;
  });

  private readonly renderQr = effect(() => {
    const link = this.upiLink();
    QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((url) => this.qrDataUrl.set(url))
      .catch(() => this.qrDataUrl.set(null));
  });

  async copyUpiId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.upiId());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set(`Could not copy. The UPI ID is ${this.upiId()}`);
    }
  }

  claim(): void {
    const reference = this.reference().trim();
    if (reference && !/^[A-Za-z0-9-]{1,50}$/.test(reference)) {
      this.error.set('The transaction id can only have letters and numbers.');
      return;
    }
    this.claiming.set(true);
    this.error.set(null);
    this.orderService.claimPayment(this.slug(), this.order().id, reference || null).subscribe({
      next: (order) => {
        this.claiming.set(false);
        this.askReference.set(false);
        this.updated.emit(order);
      },
      error: (err) => {
        this.claiming.set(false);
        this.error.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not send. Please try again.');
      }
    });
  }
}

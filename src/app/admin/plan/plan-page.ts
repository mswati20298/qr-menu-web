import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ACTION_LABELS,
  OwnerPlan,
  PLAN_STATUS_LABELS,
  PricingPlan,
  durationLabel,
  paymentMethodLabel
} from '../../core/models/subscription.model';
import { openRazorpayCheckout } from '../../core/services/razorpay-checkout';
import {
  OwnerRefunds,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_TONE,
  REFUND_WINDOW_DAYS,
  RefundablePayment
} from '../../core/models/refund.model';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { errorMessage } from '../../core/utils/http-error';

@Component({
  selector: 'app-plan-page',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './plan-page.html',
  styleUrl: './plan-page.scss'
})
export class PlanPage implements OnInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly toast = inject(FeedbackService);

  readonly plan = signal<OwnerPlan | null>(null);
  readonly error = signal<string | null>(null);
  readonly payError = signal<string | null>(null);
  readonly paySuccess = signal<string | null>(null);
  /** Id of the plan whose payment is in progress. */
  readonly payingId = signal<string | null>(null);

  readonly statusLabels = PLAN_STATUS_LABELS;
  readonly actionLabels = ACTION_LABELS;
  readonly methodLabel = paymentMethodLabel;
  readonly durationLabel = durationLabel;

  readonly refunds = signal<OwnerRefunds | null>(null);
  /** The payment whose refund form is open. */
  readonly refundFor = signal<RefundablePayment | null>(null);
  readonly refundReason = signal('');
  readonly refundSending = signal(false);
  readonly refundError = signal<string | null>(null);
  readonly refundSuccess = signal<string | null>(null);
  readonly refundLabels = REFUND_STATUS_LABELS;
  readonly refundTone = REFUND_STATUS_TONE;
  readonly refundDays = REFUND_WINDOW_DAYS;

  ngOnInit(): void {
    this.restaurantService.getPlan().subscribe({
      next: (plan) => this.plan.set(plan),
      error: () => this.error.set('Could not load your plan. Please try again.')
    });
    this.loadRefunds();
  }

  private loadRefunds(): void {
    this.restaurantService.getRefunds().subscribe({
      next: (refunds) => this.refunds.set(refunds),
      // The plan page still works without it; the refund section just stays hidden.
      error: () => this.refunds.set(null)
    });
  }

  openRefund(payment: RefundablePayment): void {
    this.refundFor.set(payment);
    this.refundReason.set('');
    this.refundError.set(null);
    this.refundSuccess.set(null);
  }

  closeRefund(): void {
    if (!this.refundSending()) {
      this.refundFor.set(null);
    }
  }

  sendRefund(): void {
    const payment = this.refundFor();
    const reason = this.refundReason().trim();
    if (!payment || this.refundSending()) {
      return;
    }
    if (reason.length < 5) {
      this.refundError.set('Please tell us in a few words why you want a refund.');
      return;
    }
    this.refundSending.set(true);
    this.refundError.set(null);
    this.restaurantService.requestRefund(payment.planPaymentId, reason).subscribe({
      next: () => {
        this.refundSending.set(false);
        this.refundFor.set(null);
        this.refundSuccess.set('Refund request sent. Once approved, the money goes back to the account you paid from.');
        this.loadRefunds();
      },
      error: (err) => {
        this.refundSending.set(false);
        this.refundError.set(errorMessage(err, 'Could not send the request. Please try again.'));
      }
    });
  }

  monthly(plan: PricingPlan): number {
    return plan.price / plan.durationMonths;
  }

  private showPaid(updated: OwnerPlan, planName: string): void {
    this.plan.set(updated);
    this.payError.set(null);
    const until = updated.current.expiresAt
      ? new Date(updated.current.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    this.paySuccess.set(`Payment received — you are on the ${planName} plan${until ? ` until ${until}` : ''}. Customers can order again.`);
    this.toast.success('Payment received. Your plan is active.');
    this.loadRefunds();
  }

  async buy(choice: PricingPlan): Promise<void> {
    if (this.payingId()) {
      return;
    }
    this.payingId.set(choice.id);
    this.payError.set(null);
    this.paySuccess.set(null);

    try {
      const checkout = await firstValueFrom(this.restaurantService.startCheckout(choice.id));
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--admin-accent').trim() || '#1b6b50';
      const result = await openRazorpayCheckout(checkout, accent);

      if (result.kind === 'paid') {
        const updated = await firstValueFrom(this.restaurantService.confirmCheckout(result.confirmation));
        this.showPaid(updated, choice.name);
      } else {
        // Closed or failed: Razorpay may still have taken a payment (the webhook applies it). Look again.
        const before = this.plan()?.current.expiresAt ?? null;
        const latest = await firstValueFrom(this.restaurantService.getPlan());
        if (latest.current.expiresAt !== before && latest.current.canTakeOrders) {
          this.showPaid(latest, choice.name);
        } else {
          this.plan.set(latest);
          if (result.kind === 'failed') {
            this.payError.set(result.message);
          }
        }
      }
    } catch (err: unknown) {
      this.payError.set(errorMessage(err, (err as Error)?.message || 'Could not complete the payment. Please try again.'));
    } finally {
      this.payingId.set(null);
    }
  }
}

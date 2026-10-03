import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { RestaurantService } from '../../core/services/restaurant.service';

@Component({
  selector: 'app-plan-page',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './plan-page.html',
  styleUrl: './plan-page.scss'
})
export class PlanPage implements OnInit {
  private readonly restaurantService = inject(RestaurantService);

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

  ngOnInit(): void {
    this.restaurantService.getPlan().subscribe({
      next: (plan) => this.plan.set(plan),
      error: () => this.error.set('Could not load your plan. Please try again.')
    });
  }

  monthly(plan: PricingPlan): number {
    return plan.price / plan.durationMonths;
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
        this.plan.set(updated);
        this.paySuccess.set(`Payment received — you are on the ${choice.name} plan until ${new Date(updated.current.expiresAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`);
      } else if (result.kind === 'failed') {
        this.payError.set(result.message);
      }
    } catch (err: unknown) {
      const httpMessage = (err as { error?: { message?: string } })?.error?.message;
      this.payError.set(httpMessage ?? (err as Error)?.message ?? 'Could not complete the payment. Please try again.');
    } finally {
      this.payingId.set(null);
    }
  }
}

import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  ACTION_LABELS,
  PAYMENT_METHODS,
  PLAN_STATUS_LABELS,
  PaymentMethod,
  PricingPlanAdmin,
  SubscriptionDetails,
  durationLabel,
  endOfLocalDay,
  paymentMethodLabel
} from '../../core/models/subscription.model';
import { SuperAdminService } from '../../core/services/super-admin.service';

type Tab = 'payment' | 'free' | 'extend' | 'cancel';

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-subscription-dialog',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './subscription-dialog.html',
  styleUrl: './subscription-dialog.scss'
})
export class SubscriptionDialog implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly fb = inject(FormBuilder);

  readonly restaurantId = input.required<string>();
  readonly restaurantName = input.required<string>();

  /** Emitted after every successful change so the list can refresh its plan column. */
  readonly changed = output<SubscriptionDetails>();
  readonly close = output<void>();

  readonly details = signal<SubscriptionDetails | null>(null);
  readonly tab = signal<Tab>('payment');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly paymentMethods = PAYMENT_METHODS;
  readonly statusLabels = PLAN_STATUS_LABELS;
  readonly actionLabels = ACTION_LABELS;
  readonly methodLabel = paymentMethodLabel;
  readonly minDate = todayPlus(1);
  readonly durationLabel = durationLabel;
  readonly plans = signal<PricingPlanAdmin[]>([]);

  readonly paymentForm = this.fb.group({
    pricingPlanId: this.fb.nonNullable.control('', Validators.required),
    periods: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1), Validators.max(36)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    paymentMethod: this.fb.nonNullable.control<PaymentMethod>('Upi'),
    paymentReference: this.fb.nonNullable.control('', Validators.maxLength(100)),
    note: this.fb.nonNullable.control('', Validators.maxLength(500))
  });

  readonly freeForm = this.fb.group({
    lifetime: this.fb.nonNullable.control(false),
    until: this.fb.nonNullable.control(todayPlus(30)),
    note: this.fb.nonNullable.control('', Validators.maxLength(500))
  });

  readonly extendForm = this.fb.group({
    until: this.fb.nonNullable.control('', Validators.required),
    note: this.fb.nonNullable.control('', Validators.maxLength(500))
  });

  readonly cancelForm = this.fb.group({
    note: this.fb.nonNullable.control('', Validators.maxLength(500))
  });

  ngOnInit(): void {
    this.service.plans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        const first = plans.find((p) => p.isActive) ?? plans[0];
        if (first) {
          this.paymentForm.controls.pricingPlanId.setValue(first.id);
          this.suggestAmount();
        }
      }
    });

    this.service.subscription(this.restaurantId()).subscribe({
      next: (details) => this.setDetails(details),
      error: () => this.error.set('Could not load the plan.')
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  /** Fills in the plan price × periods; the super admin can still change it (discounts). */
  suggestAmount(): void {
    const plan = this.plans().find((p) => p.id === this.paymentForm.controls.pricingPlanId.value);
    if (plan) {
      this.paymentForm.controls.amount.setValue(plan.price * (this.paymentForm.controls.periods.value || 1));
    }
  }

  selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.error.set(null);
    this.success.set(null);
  }

  submitPayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const v = this.paymentForm.getRawValue();
    this.run(
      this.service.recordPayment(this.restaurantId(), {
        pricingPlanId: v.pricingPlanId,
        periods: v.periods,
        amount: v.amount!,
        paymentMethod: v.paymentMethod,
        paymentReference: v.paymentReference.trim() || null,
        note: v.note.trim() || null
      }),
      'Payment recorded.',
      () => {
        this.paymentForm.reset({ pricingPlanId: v.pricingPlanId, periods: 1, paymentMethod: v.paymentMethod });
        this.suggestAmount();
      }
    );
  }

  submitFree(): void {
    const v = this.freeForm.getRawValue();
    if (!v.lifetime && !v.until) {
      this.error.set('Choose the date the free plan ends, or make it lifetime.');
      return;
    }
    this.run(
      this.service.grantFree(this.restaurantId(), {
        lifetime: v.lifetime,
        until: v.lifetime ? null : endOfLocalDay(v.until),
        note: v.note.trim() || null
      }),
      v.lifetime ? 'Lifetime free plan given.' : 'Free plan given.'
    );
  }

  submitExtend(): void {
    if (this.extendForm.invalid) {
      this.extendForm.markAllAsTouched();
      return;
    }
    const v = this.extendForm.getRawValue();
    this.run(
      this.service.extend(this.restaurantId(), { until: endOfLocalDay(v.until), note: v.note.trim() || null }),
      'Plan extended.'
    );
  }

  submitCancel(): void {
    if (!confirm(`Cancel the plan of "${this.restaurantName()}"?\n\nCustomers will not be able to place orders from now on.`)) {
      return;
    }
    this.run(this.service.cancel(this.restaurantId(), this.cancelForm.getRawValue().note.trim() || null), 'Plan cancelled.');
  }

  private run(request: Observable<SubscriptionDetails>, message: string, after?: () => void): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    request.subscribe({
      next: (details) => {
        this.saving.set(false);
        this.setDetails(details);
        this.success.set(message);
        this.changed.emit(details);
        after?.();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not save. Please try again.');
      }
    });
  }

  private setDetails(details: SubscriptionDetails): void {
    this.details.set(details);
    const expiresAt = details.current.expiresAt;
    if (expiresAt) {
      // Suggest one month after the current end (or after today, if that is later).
      const base = new Date(Math.max(new Date(expiresAt).getTime(), Date.now()));
      base.setMonth(base.getMonth() + 1);
      this.extendForm.controls.until.setValue(
        `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      );
    }
  }
}

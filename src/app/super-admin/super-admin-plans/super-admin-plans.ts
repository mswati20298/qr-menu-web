import { DecimalPipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PricingPlanAdmin, SavePricingPlanRequest, durationLabel } from '../../core/models/subscription.model';
import { SuperAdminService } from '../../core/services/super-admin.service';

/** The plan catalog. Only the super admin manages it; owners just see the active plans to buy. */
@Component({
  selector: 'app-super-admin-plans',
  imports: [DecimalPipe, ReactiveFormsModule],
  templateUrl: './super-admin-plans.html',
  styleUrl: './super-admin-plans.scss'
})
export class SuperAdminPlans implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly fb = inject(FormBuilder);

  readonly plans = signal<PricingPlanAdmin[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  /** null = form closed, 'new' = creating, otherwise the plan being edited. */
  readonly editing = signal<PricingPlanAdmin | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly durationLabel = durationLabel;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    durationMonths: [1, [Validators.required, Validators.min(1), Validators.max(60)]],
    price: [499, [Validators.required, Validators.min(1)]],
    isActive: [true],
    sortOrder: [0, [Validators.min(0), Validators.max(1000)]]
  });

  ngOnInit(): void {
    this.load();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.saving()) {
      this.editing.set(null);
    }
  }

  openNew(): void {
    this.form.reset({ name: '', description: '', durationMonths: 1, price: 499, isActive: true, sortOrder: this.plans().length + 1 });
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(plan: PricingPlanAdmin): void {
    this.form.reset({
      name: plan.name,
      description: plan.description ?? '',
      durationMonths: plan.durationMonths,
      price: plan.price,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder
    });
    this.formError.set(null);
    this.editing.set(plan);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: SavePricingPlanRequest = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      durationMonths: v.durationMonths,
      price: v.price,
      isActive: v.isActive,
      sortOrder: v.sortOrder
    };

    const target = this.editing();
    const call = target === 'new' || target === null ? this.service.createPlan(request) : this.service.updatePlan(target.id, request);

    this.saving.set(true);
    this.formError.set(null);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not save the plan.');
      }
    });
  }

  toggleActive(plan: PricingPlanAdmin): void {
    this.busyId.set(plan.id);
    this.error.set(null);
    this.service
      .updatePlan(plan.id, {
        name: plan.name,
        description: plan.description,
        durationMonths: plan.durationMonths,
        price: plan.price,
        isActive: !plan.isActive,
        sortOrder: plan.sortOrder
      })
      .subscribe({
        next: (updated) => {
          this.busyId.set(null);
          this.plans.set(this.plans().map((p) => (p.id === updated.id ? updated : p)));
        },
        error: (err) => {
          this.busyId.set(null);
          this.error.set(err?.error?.message ?? 'Could not change the plan.');
        }
      });
  }

  remove(plan: PricingPlanAdmin): void {
    if (!confirm(`Delete the plan "${plan.name}"? This cannot be undone.`)) {
      return;
    }
    this.busyId.set(plan.id);
    this.error.set(null);
    this.service.deletePlan(plan.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.plans.set(this.plans().filter((p) => p.id !== plan.id));
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(err?.error?.message ?? 'Could not delete the plan.');
      }
    });
  }

  monthlyEquivalent(plan: { price: number; durationMonths: number }): number {
    return plan.price / plan.durationMonths;
  }

  private load(): void {
    this.loading.set(true);
    this.service.plans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load plans.');
      }
    });
  }
}

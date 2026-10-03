import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { SuperAdminRestaurant } from '../../core/models/super-admin.model';
import { PLAN_STATUS_LABELS, SubscriptionDetails } from '../../core/models/subscription.model';
import { PlanFilter, SuperAdminService } from '../../core/services/super-admin.service';
import { SubscriptionDialog } from '../subscription-dialog/subscription-dialog';

type StatusFilter = '' | 'active' | 'suspended';

@Component({
  selector: 'app-super-admin-restaurants',
  imports: [DatePipe, SubscriptionDialog],
  templateUrl: './super-admin-restaurants.html',
  styleUrl: './super-admin-restaurants.scss'
})
export class SuperAdminRestaurants implements OnInit, OnDestroy {
  private readonly service = inject(SuperAdminService);

  readonly pageSize = 20;
  readonly items = signal<SuperAdminRestaurant[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly planTarget = signal<SuperAdminRestaurant | null>(null);
  readonly planStatusLabels = PLAN_STATUS_LABELS;

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  private search = '';
  private status: StatusFilter = '';
  private plan: PlanFilter = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  onSearch(value: string): void {
    this.search = value.trim();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  onStatus(value: string): void {
    this.status = value === 'active' || value === 'suspended' ? value : '';
    this.page.set(1);
    this.load();
  }

  onPlan(value: string): void {
    const allowed: PlanFilter[] = ['trial', 'free', 'paid', 'expiring', 'grace', 'stopped'];
    this.plan = allowed.includes(value as PlanFilter) ? (value as PlanFilter) : '';
    this.page.set(1);
    this.load();
  }

  openPlan(restaurant: SuperAdminRestaurant): void {
    this.planTarget.set(restaurant);
  }

  /** Keep the list row in step with what the plan dialog just saved. */
  onPlanChanged(details: SubscriptionDetails): void {
    this.items.set(
      this.items().map((item) =>
        item.id === details.restaurantId
          ? { ...item, plan: details.current.plan, planName: details.current.planName, planStatus: details.current.status, planExpiresAt: details.current.expiresAt }
          : item
      )
    );
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pageCount() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  toggleStatus(restaurant: SuperAdminRestaurant): void {
    const activate = !restaurant.isActive;
    const message = activate
      ? `Activate "${restaurant.name}"? Its owner can log in again and customers can order.`
      : `Suspend "${restaurant.name}"?\n\nIts owner is signed out of the admin panel and customers can no longer open its menu or place orders.`;

    if (!confirm(message)) {
      return;
    }

    this.busyId.set(restaurant.id);
    this.error.set(null);
    this.service.setStatus(restaurant.id, activate).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.items.set(this.items().map((item) => (item.id === updated.id ? updated : item)));
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(err?.error?.message ?? 'Could not change the status. Please try again.');
      }
    });
  }

  menuUrl(slug: string): string {
    return `${window.location.origin}/m/${slug}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .restaurants({ search: this.search, status: this.status, plan: this.plan, page: this.page(), pageSize: this.pageSize })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Could not load restaurants.');
        }
      });
  }
}

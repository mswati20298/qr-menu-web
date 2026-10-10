import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { SuperAdminRestaurant } from '../../core/models/super-admin.model';
import { PLAN_STATUS_LABELS, SubscriptionDetails } from '../../core/models/subscription.model';
import { FeedbackService } from '../../core/services/feedback.service';
import { PlanFilter, SuperAdminService } from '../../core/services/super-admin.service';
import { SubscriptionDialog } from '../subscription-dialog/subscription-dialog';
import { DeleteForeverDialog } from './delete-forever-dialog/delete-forever-dialog';
import { errorMessage } from '../../core/utils/http-error';

type StatusFilter = '' | 'active' | 'suspended' | 'deleted';

@Component({
  selector: 'app-super-admin-restaurants',
  imports: [DatePipe, SubscriptionDialog, DeleteForeverDialog],
  templateUrl: './super-admin-restaurants.html',
  styleUrl: './super-admin-restaurants.scss'
})
export class SuperAdminRestaurants implements OnInit, OnDestroy {
  private readonly service = inject(SuperAdminService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = 20;
  readonly items = signal<SuperAdminRestaurant[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly planTarget = signal<SuperAdminRestaurant | null>(null);
  readonly planStatusLabels = PLAN_STATUS_LABELS;
  /** Restaurant whose "Delete forever" dialog is open. */
  readonly deleteTarget = signal<SuperAdminRestaurant | null>(null);
  readonly deleteBusy = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  private search = '';
  private status: StatusFilter = '';
  plan: PlanFilter = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // The dashboard links here with ?plan=expiring etc.
    const plan = this.route.snapshot.queryParamMap.get('plan');
    if (plan) {
      this.onPlan(plan);
      return;
    }
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
    this.status = value === 'active' || value === 'suspended' || value === 'deleted' ? value : '';
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

  async toggleStatus(restaurant: SuperAdminRestaurant): Promise<void> {
    const activate = !restaurant.isActive;
    const confirmed = await this.feedback.confirm(
      activate
        ? {
            title: `Activate "${restaurant.name}"?`,
            message: 'Its owner can log in again and customers can order.',
            confirmLabel: 'Activate'
          }
        : {
            title: `Suspend "${restaurant.name}"?`,
            message: 'Its owner is signed out of the admin panel and customers can no longer open its menu or place orders.',
            confirmLabel: 'Suspend',
            danger: true
          }
    );
    if (!confirmed) {
      return;
    }

    this.busyId.set(restaurant.id);
    this.error.set(null);
    this.service.setStatus(restaurant.id, activate).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.items.set(this.items().map((item) => (item.id === updated.id ? updated : item)));
        this.feedback.success(`${updated.name} ${updated.isActive ? 'activated' : 'suspended'}.`);
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(errorMessage(err, 'Could not change the status. Please try again.'));
      }
    });
  }

  /** Soft delete: hidden from the list, owner signed out, menu offline. Restore brings everything back. */
  async softDelete(restaurant: SuperAdminRestaurant): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Delete "${restaurant.name}"?`,
      message:
        'It disappears from the list, its owner is signed out and customers can no longer open its menu. ' +
        'Nothing is removed yet: you can restore it from the "Deleted" filter, or delete it forever there.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.busyId.set(restaurant.id);
    this.error.set(null);
    this.service.softDeleteRestaurant(restaurant.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.feedback.success(`${restaurant.name} deleted. Find it under the "Deleted" filter to restore it.`);
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(errorMessage(err, 'Could not delete the restaurant.'));
      }
    });
  }

  restore(restaurant: SuperAdminRestaurant): void {
    this.busyId.set(restaurant.id);
    this.error.set(null);
    this.service.restoreRestaurant(restaurant.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.feedback.success(`${restaurant.name} restored. Its owner can log in again.`);
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(errorMessage(err, 'Could not restore the restaurant.'));
      }
    });
  }

  openDeleteForever(restaurant: SuperAdminRestaurant): void {
    this.deleteError.set(null);
    this.deleteTarget.set(restaurant);
  }

  closeDeleteForever(): void {
    if (!this.deleteBusy()) {
      this.deleteTarget.set(null);
    }
  }

  deleteForever(confirmName: string): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleteBusy.set(true);
    this.deleteError.set(null);
    this.service.hardDeleteRestaurant(target.id, confirmName).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.deleteTarget.set(null);
        this.feedback.success(`${target.name} and all its data were deleted.`);
        this.load();
      },
      error: (err) => {
        this.deleteBusy.set(false);
        this.deleteError.set(errorMessage(err, 'Could not delete the restaurant.'));
      }
    });
  }

  async resetPassword(restaurant: SuperAdminRestaurant): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Reset the owner password of "${restaurant.name}"?`,
      message: 'The owner gets a new temporary password and is signed out everywhere. Share it with them, then ask them to change it under Settings.',
      confirmLabel: 'Reset password',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(restaurant.id);
    this.error.set(null);
    this.service.resetOwnerPassword(restaurant.id).subscribe({
      next: async (result) => {
        this.busyId.set(null);
        const copy = await this.feedback.confirm({
          title: 'New temporary password',
          message: `${result.ownerEmail}
${result.temporaryPassword}

This is shown only once.`,
          confirmLabel: 'Copy password',
          cancelLabel: 'Close'
        });
        if (copy) {
          navigator.clipboard.writeText(result.temporaryPassword).then(
            () => this.feedback.success('Password copied.'),
            () => this.feedback.error('Could not copy. Please note it down.')
          );
        }
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(errorMessage(err, 'Could not reset the password. Please try again.'));
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

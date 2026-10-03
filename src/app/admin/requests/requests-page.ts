import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { serviceRequestMeta } from '../../core/models/service-request.model';
import { OrderNotificationService } from '../../core/services/order-notification.service';

/** A request waiting longer than this is highlighted. */
const LATE_AFTER_MINUTES = 5;

@Component({
  selector: 'app-requests-page',
  templateUrl: './requests-page.html',
  styleUrl: './requests-page.scss'
})
export class RequestsPage implements OnInit, OnDestroy {
  private readonly notifications = inject(OrderNotificationService);

  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly items = computed(() =>
    this.notifications.pendingRequests().map((request) => ({ ...request, meta: serviceRequestMeta(request.type) }))
  );

  ngOnInit(): void {
    this.notifications.refreshRequests();
    this.timer = setInterval(() => this.now.set(Date.now()), 30000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  done(id: string): void {
    this.notifications.completeRequest(id);
  }

  private minutesWaiting(createdAt: string): number {
    return Math.max(0, Math.floor((this.now() - new Date(createdAt).getTime()) / 60000));
  }

  isLate(createdAt: string): boolean {
    return this.minutesWaiting(createdAt) >= LATE_AFTER_MINUTES;
  }

  timeAgo(createdAt: string): string {
    const minutes = this.minutesWaiting(createdAt);
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  }
}

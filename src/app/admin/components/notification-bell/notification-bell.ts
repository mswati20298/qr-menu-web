import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OrderNotificationService } from '../../../core/services/order-notification.service';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss'
})
export class NotificationBell {
  private readonly router = inject(Router);
  readonly notifications = inject(OrderNotificationService);

  onClick(): void {
    this.notifications.markAllRead();
    this.router.navigate(['/admin/orders']);
  }
}

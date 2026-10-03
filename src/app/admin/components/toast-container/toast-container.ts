import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OrderNotificationService, OrderToast } from '../../../core/services/order-notification.service';

@Component({
  selector: 'app-toast-container',
  imports: [DecimalPipe],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss'
})
export class ToastContainer {
  readonly notifications = inject(OrderNotificationService);
  private readonly router = inject(Router);

  openToast(toast: OrderToast): void {
    if (toast.kind === 'request') {
      this.router.navigate(['/admin/requests']);
      return;
    }
    this.notifications.markAllRead();
    this.router.navigate(['/admin/orders']);
  }
}

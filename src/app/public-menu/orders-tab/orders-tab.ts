import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Order } from '../../core/models/order.model';
import { CustomerProfileService } from '../../core/services/customer-profile.service';
import { OrderService } from '../../core/services/order.service';
import { PublicSessionService } from '../../core/services/public-session.service';

@Component({
  selector: 'app-orders-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './orders-tab.html',
  styleUrl: './orders-tab.scss'
})
export class OrdersTab implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly session = inject(PublicSessionService);
  private readonly orderService = inject(OrderService);
  private readonly profileService = inject(CustomerProfileService);
  private readonly router = inject(Router);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(false);
  readonly searched = signal(false);

  readonly phoneForm = this.fb.group({
    phone: this.fb.control(this.profileService.current().phone, [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)])
  });

  ngOnInit(): void {
    const phone = this.profileService.current().phone;
    if (phone) {
      this.loadOrders(phone);
    }
  }

  loadOrders(phone: string): void {
    this.loading.set(true);
    this.searched.set(true);
    this.orderService.getOrdersByPhone(this.session.slug(), phone).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  submitPhone(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }
    const phone = this.phoneForm.getRawValue().phone!;
    this.profileService.save({ name: this.profileService.current().name, phone });
    this.loadOrders(phone);
  }

  openOrder(order: Order): void {
    this.router.navigate(['/m', this.session.slug(), 'order', order.id]);
  }

  statusClass(status: string): string {
    return `orders-tab__status orders-tab__status--${status.toLowerCase()}`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}

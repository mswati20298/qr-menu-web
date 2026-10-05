import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderStatus } from '../../core/models/order.model';
import { OrderService } from '../../core/services/order.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { BillSummary } from '../components/bill-summary/bill-summary';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { UpiPayCard } from '../components/upi-pay-card/upi-pay-card';

const STATUS_STEPS: OrderStatus[] = ['Placed', 'Preparing', 'Served', 'Completed'];
const POLL_INTERVAL_MS = 8000;

@Component({
  selector: 'app-order-status-page',
  imports: [BillSummary, ConfirmDialog, UpiPayCard],
  templateUrl: './order-status-page.html',
  styleUrl: './order-status-page.scss'
})
export class OrderStatusPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  readonly session = inject(PublicSessionService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  readonly statusSteps = STATUS_STEPS;
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly showCancelConfirm = signal(false);
  slug = '';
  private orderId = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? this.route.parent?.snapshot.paramMap.get('slug') ?? '';
    this.orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
    this.session.init(this.slug, this.session.tableNumber());
    this.fetchOrder();

    this.pollHandle = setInterval(() => {
      // Keep checking while the kitchen is working, and while staff have not yet confirmed a UPI payment.
      const order = this.order();
      const cooking = order && order.status !== 'Completed' && order.status !== 'Cancelled';
      const awaitingPayment = order?.paymentStatus === 'Claimed';
      if (cooking || awaitingPayment) {
        this.fetchOrder();
      }
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
  }

  private fetchOrder(): void {
    this.orderService.getPublicOrder(this.slug, this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  stepIndex(status: OrderStatus): number {
    return this.statusSteps.indexOf(status);
  }

  tableLabel(): string {
    const table = this.order()?.tableNumber;
    return table ? `Table ${table}` : 'Takeaway';
  }

  statusHeroClass(): string {
    const status = this.order()?.status;
    if (status === 'Preparing') return 'order-status-page__hero--preparing';
    if (status === 'Served' || status === 'Completed') return 'order-status-page__hero--served';
    if (status === 'Cancelled') return 'order-status-page__hero--cancelled';
    return 'order-status-page__hero--placed';
  }

  statusTitle(): string {
    const status = this.order()?.status;
    switch (status) {
      case 'Preparing': return 'Being prepared';
      case 'Served': return 'Served — enjoy!';
      case 'Completed': return 'Order completed';
      case 'Cancelled': return 'Order cancelled';
      default: return 'Order placed!';
    }
  }

  backToMenu(): void {
    this.router.navigate(['/m', this.slug, 'menu']);
  }

  requestCancelOrder(): void {
    this.showCancelConfirm.set(true);
  }

  dismissCancelConfirm(): void {
    this.showCancelConfirm.set(false);
  }

  confirmCancelOrder(): void {
    this.showCancelConfirm.set(false);
    this.cancelling.set(true);

    this.orderService.cancelOrder(this.slug, this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.cancelling.set(false);
        this.feedback.success('Order cancelled.');
      },
      error: (err) => {
        this.cancelling.set(false);
        this.feedback.error(err?.error?.message ?? 'Could not cancel this order. Please try again.');
      }
    });
  }
}

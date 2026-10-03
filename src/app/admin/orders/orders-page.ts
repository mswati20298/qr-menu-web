import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Invoice } from '../../core/models/invoice.model';
import { Order, OrderStatus, StaffPaymentMethod } from '../../core/models/order.model';
import { InvoiceService } from '../../core/services/invoice.service';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { ReportRange, downloadCsv, filterOrdersByRange, ordersToCsv } from '../../core/services/report-export.util';
import { StatusPill } from '../components/status-pill/status-pill';
import { OrderKanbanCard } from './components/order-kanban-card/order-kanban-card';

type ViewMode = 'board' | 'list';

interface BoardColumn {
  status: OrderStatus;
  label: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
  { status: 'Placed', label: 'New' },
  { status: 'Preparing', label: 'Preparing' },
  { status: 'Served', label: 'Served' },
  { status: 'Completed', label: 'Completed' }
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Placed: 'Preparing',
  Preparing: 'Served',
  Served: 'Completed'
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  Placed: 'Accept',
  Preparing: 'Mark ready',
  Served: 'Complete'
};

const LATE_AMBER_MINUTES = 10;
const LATE_RED_MINUTES = 20;
const TICK_INTERVAL_MS = 30000;
const SILENT_REFRESH_MS = 15000;
const UNDO_WINDOW_MS = 6000;

const STATUS_FILTERS: (OrderStatus | 'All')[] = ['All', 'Placed', 'Preparing', 'Served', 'Completed', 'Cancelled'];

interface PendingUndo {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  handle: ReturnType<typeof setTimeout>;
}

@Component({
  selector: 'app-orders-page',
  imports: [DecimalPipe, RouterLink, StatusPill, OrderKanbanCard],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss'
})
export class OrdersPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly router = inject(Router);
  readonly notifications = inject(OrderNotificationService);

  readonly boardColumns = BOARD_COLUMNS;
  readonly statusFilters = STATUS_FILTERS;

  readonly viewMode = signal<ViewMode>('board');
  readonly showCancelled = signal(false);
  readonly activeFilter = signal<OrderStatus | 'All'>('All');
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly expandedId = signal<string | null>(null);
  readonly reportRange = signal<ReportRange>('today');
  readonly nowTick = signal(Date.now());
  readonly pendingUndo = signal<PendingUndo | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  readonly cancelledOrders = computed(() => this.orders().filter((o) => o.status === 'Cancelled'));

  readonly filteredOrders = computed(() => {
    const filter = this.activeFilter();
    const all = this.orders();
    return filter === 'All' ? all : all.filter((o) => o.status === filter);
  });

  ngOnInit(): void {
    this.reload();
    this.notifications.markAllRead();

    this.tickHandle = setInterval(() => this.nowTick.set(Date.now()), TICK_INTERVAL_MS);
    this.refreshHandle = setInterval(() => this.reload(true), SILENT_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    if (this.refreshHandle) clearInterval(this.refreshHandle);
    if (this.pendingUndo()) clearTimeout(this.pendingUndo()!.handle);
  }

  private reload(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.orderService.getAllForOwner().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        if (!silent) this.loading.set(false);
      },
      error: () => {
        if (!silent) this.loading.set(false);
      }
    });
  }

  isNew(orderId: string): boolean {
    return this.notifications.newOrderIds().has(orderId);
  }

  ordersForColumn(status: OrderStatus): Order[] {
    return this.orders().filter((o) => o.status === status);
  }

  filterCount(filter: OrderStatus | 'All'): number {
    return filter === 'All' ? this.orders().length : this.orders().filter((o) => o.status === filter).length;
  }

  actionLabel(status: OrderStatus): string | null {
    return ACTION_LABELS[status] ?? null;
  }

  canCancel(status: OrderStatus): boolean {
    return status !== 'Completed' && status !== 'Cancelled';
  }

  elapsedLabel(order: Order): string {
    this.nowTick();
    const mins = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m ago`;
  }

  urgency(order: Order): 'normal' | 'amber' | 'red' {
    if (order.status !== 'Placed' && order.status !== 'Preparing') {
      return 'normal';
    }
    this.nowTick();
    const mins = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    if (mins >= LATE_RED_MINUTES) return 'red';
    if (mins >= LATE_AMBER_MINUTES) return 'amber';
    return 'normal';
  }

  primaryAction(order: Order): void {
    const next = NEXT_STATUS[order.status];
    if (!next) {
      return;
    }
    this.applyStatusChange(order, next);
  }

  private applyStatusChange(order: Order, next: OrderStatus): void {
    const previous = order.status;
    this.orders.set(this.orders().map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    this.notifications.refreshActiveCount();
    this.clearPendingUndo();

    const handle = setTimeout(() => this.pendingUndo.set(null), UNDO_WINDOW_MS);
    this.pendingUndo.set({ orderId: order.id, fromStatus: previous, toStatus: next, handle });

    this.orderService.updateStatus(order.id, next).subscribe({
      next: (updated) => {
        this.orders.set(this.orders().map((o) => (o.id === updated.id ? updated : o)));
      },
      error: () => {
        this.orders.set(this.orders().map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
        this.clearPendingUndo();
        this.notifications.refreshActiveCount();
      }
    });
  }

  undoLastChange(): void {
    const pending = this.pendingUndo();
    if (!pending) {
      return;
    }
    clearTimeout(pending.handle);
    this.pendingUndo.set(null);

    this.orders.set(
      this.orders().map((o) => (o.id === pending.orderId ? { ...o, status: pending.fromStatus } : o))
    );

    this.orderService.updateStatus(pending.orderId, pending.fromStatus).subscribe({
      next: (updated) => {
        this.orders.set(this.orders().map((o) => (o.id === updated.id ? updated : o)));
        this.notifications.refreshActiveCount();
      },
      error: () => {
        // Best-effort — local state already reflects the intended undo.
      }
    });
  }

  private clearPendingUndo(): void {
    const pending = this.pendingUndo();
    if (pending) {
      clearTimeout(pending.handle);
    }
    this.pendingUndo.set(null);
  }

  cancelOrder(order: Order): void {
    if (!confirm('Cancel this order?')) {
      return;
    }
    this.orderService.updateStatus(order.id, 'Cancelled').subscribe((updated) => {
      this.orders.set(this.orders().map((o) => (o.id === updated.id ? updated : o)));
      this.notifications.refreshActiveCount();
    });
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
    this.actionError.set(null);
  }

  paymentLabel(order: Order): string {
    switch (order.paymentStatus) {
      case 'Paid':
        return order.paymentMethod ? `Paid · ${order.paymentMethod === 'Upi' ? 'UPI' : order.paymentMethod}` : 'Paid';
      case 'Claimed':
        return 'UPI payment claimed';
      default:
        return 'Unpaid';
    }
  }

  markPaid(order: Order, method: StaffPaymentMethod): void {
    this.runPayment(order, this.orderService.updatePayment(order.id, 'Paid', method));
  }

  /** The customer's UPI claim did not show up in the restaurant's account. */
  rejectPayment(order: Order): void {
    if (!confirm('Mark this payment as not received? The customer will see it as unpaid again.')) {
      return;
    }
    this.runPayment(order, this.orderService.updatePayment(order.id, 'Unpaid'));
  }

  createBill(order: Order): void {
    this.runBill(order, this.invoiceService.createForOrder(order.id));
  }

  billTable(order: Order): void {
    this.runBill(order, this.invoiceService.createForTable(order.tableNumber!));
  }

  private runPayment(order: Order, call: Observable<Order>): void {
    this.busyId.set(order.id);
    this.actionError.set(null);
    call.subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.orders.set(this.orders().map((o) => (o.id === updated.id ? updated : o)));
      },
      error: (err) => {
        this.busyId.set(null);
        this.actionError.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not update the payment.');
      }
    });
  }

  private runBill(order: Order, call: Observable<Invoice>): void {
    this.busyId.set(order.id);
    this.actionError.set(null);
    call.subscribe({
      next: (invoice) => {
        this.busyId.set(null);
        this.router.navigate(['/admin/invoices'], { queryParams: { open: invoice.id } });
      },
      error: (err) => {
        this.busyId.set(null);
        this.actionError.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not create the bill.');
      }
    });
  }

  nextStatus(status: OrderStatus): OrderStatus | null {
    return NEXT_STATUS[status] ?? null;
  }

  advanceStatus(order: Order): void {
    this.primaryAction(order);
  }

  tableLabel(order: Order): string {
    return order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway';
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === now.toDateString()) {
      return time;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${time}`;
    }

    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
  }

  addOnNames(addOns: { name: string }[]): string {
    return addOns.map((a) => a.name).join(', ');
  }

  exportReport(): void {
    const range = this.reportRange();
    const filtered = filterOrdersByRange(this.orders(), range).filter((o) => o.status !== 'Cancelled');
    const csv = ordersToCsv(filtered);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `orders-report-${range}-${dateStamp}.csv`);
  }
}

import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Invoice } from '../../core/models/invoice.model';
import { Order, OrderStatus, StaffPaymentMethod } from '../../core/models/order.model';
import { InvoiceService } from '../../core/services/invoice.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { ReportRange, downloadCsv, ordersToCsv, rangeBounds, reportFileName } from '../../core/services/report-export.util';
import { ReportExport } from '../components/report-export/report-export';
import { StatusPill } from '../components/status-pill/status-pill';
import { OrderKanbanCard } from './components/order-kanban-card/order-kanban-card';
import { errorMessage } from '../../core/utils/http-error';

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
  imports: [DecimalPipe, RouterLink, StatusPill, OrderKanbanCard, ReportExport],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss'
})
export class OrdersPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly feedback = inject(FeedbackService);
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
  readonly exporting = signal(false);
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

  async cancelOrder(order: Order): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Cancel the order for ${this.tableLabel(order)}?`,
      message: 'The kitchen will not prepare it and the customer sees it as cancelled.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.orderService.updateStatus(order.id, 'Cancelled').subscribe({
      next: (updated) => {
        this.orders.set(this.orders().map((o) => (o.id === updated.id ? updated : o)));
        this.notifications.refreshActiveCount();
        this.feedback.success(`Order for ${this.tableLabel(order)} cancelled.`);
      },
      error: (err) => this.feedback.error(errorMessage(err, 'Could not cancel the order.'))
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
  async rejectPayment(order: Order): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: 'Payment not received?',
      message: 'The order goes back to unpaid and the customer can pay again.',
      confirmLabel: 'Not received',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.runPayment(order, this.orderService.updatePayment(order.id, 'Unpaid'));
  }

  /**
   * Board card's bill button: one bill per guest (same table and same phone). If that guest already has a bill
   * that is not paid yet, the new orders are added to it (the server does the same). Takeaway bills just that order.
   */
  async billFromBoard(order: Order): Promise<void> {
    const orders = this.guestUnbilledOrders(order);
    const open = this.guestOpenBill(order);
    const total = orders.reduce((sum, o) => sum + o.total, 0);
    const who = order.customerName ? `${order.customerName} (${this.tableLabel(order)})` : this.tableLabel(order);

    // Invoice numbers are permanent, so always confirm what goes on the bill.
    const confirmed = await this.feedback.confirm(
      open
        ? {
            title: `Add to bill ${open.number}?`,
            message: `${orders.length} new order${orders.length === 1 ? '' : 's'} of ${who} (₹${total.toFixed(2)}) go on the same bill. New bill total ₹${(open.total + total).toFixed(2)}.`,
            confirmLabel: 'Add to bill'
          }
        : {
            title: `Bill ${who}?`,
            message:
              orders.length > 1
                ? `${orders.length} orders go on one bill, total ₹${total.toFixed(2)}. Same dishes are combined into one line.`
                : `1 order, total ₹${total.toFixed(2)}.`,
            confirmLabel: 'Create bill'
          }
    );
    if (!confirmed) {
      return;
    }
    this.createBill(order);
  }

  /** Label for the board card's bill button. */
  billLabel(order: Order): string {
    const open = this.guestOpenBill(order);
    if (open) {
      return `Add to ${open.number}`;
    }
    const count = this.guestUnbilledOrders(order).length;
    return count > 1 ? `Bill ${count} orders` : 'Create bill';
  }

  /** Same guest = same table and same phone (or both without one), within the last 24 hours. Takeaway: just itself. */
  private sameGuest(a: Order, b: Order): boolean {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return (
      !!a.tableNumber &&
      a.tableNumber === b.tableNumber &&
      (a.customerPhone || null) === (b.customerPhone || null) &&
      b.status !== 'Cancelled' &&
      new Date(b.createdAt).getTime() >= since
    );
  }

  /** The guest's orders that are not on a bill yet (always includes this one). */
  private guestUnbilledOrders(order: Order): Order[] {
    if (!order.tableNumber) {
      return [order];
    }
    const others = this.orders().filter((o) => o.id !== order.id && !o.invoiceId && this.sameGuest(order, o));
    return [order, ...others];
  }

  /** The guest's bill that is not fully paid yet, if any: new orders join it. */
  private guestOpenBill(order: Order): { number: string; total: number } | null {
    const onBill = this.orders().filter((o) => o.invoiceId && this.sameGuest(order, o));
    const open = onBill.find((o) => o.paymentStatus !== 'Paid');
    if (!open) {
      return null;
    }
    const billOrders = onBill.filter((o) => o.invoiceId === open.invoiceId);
    return { number: open.invoiceNumber ?? 'the open bill', total: billOrders.reduce((sum, o) => sum + o.total, 0) };
  }

  openInvoice(order: Order): void {
    if (order.invoiceId) {
      this.router.navigate(['/admin/invoices'], { queryParams: { open: order.invoiceId } });
    }
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
        this.feedback.success(
          updated.paymentStatus === 'Paid'
            ? `${this.tableLabel(updated)}: payment marked received.`
            : `${this.tableLabel(updated)}: payment marked not received.`
        );
      },
      error: (err) => {
        this.busyId.set(null);
        // The board view has no inline error area, so always show a toast too.
        const message = errorMessage(err, 'Could not update the payment.');
        this.actionError.set(message);
        this.feedback.error(message);
      }
    });
  }

  private runBill(order: Order, call: Observable<Invoice>): void {
    this.busyId.set(order.id);
    this.actionError.set(null);
    call.subscribe({
      next: (invoice) => {
        this.busyId.set(null);
        this.feedback.success(`Bill ${invoice.number}: ${invoice.orderIds.length} order${invoice.orderIds.length === 1 ? '' : 's'}, ₹${invoice.total.toFixed(2)}.`);
        this.router.navigate(['/admin/invoices'], { queryParams: { open: invoice.id } });
      },
      error: (err) => {
        this.busyId.set(null);
        // The board has no inline error area, so always show a toast too.
        const message = errorMessage(err, 'Could not create the bill.');
        this.actionError.set(message);
        this.feedback.error(message);
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

  /** Asks the server for the whole period (the page itself only holds the last 7 days and open orders). */
  exportReport(range: ReportRange): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    const { from, to } = rangeBounds(range);
    this.orderService.getForPeriod(from, to).subscribe({
      next: (orders) => {
        this.exporting.set(false);
        const kept = orders.filter((o) => o.status !== 'Cancelled');
        if (kept.length === 0) {
          this.feedback.info('No orders in that period.');
          return;
        }
        downloadCsv(ordersToCsv(kept), reportFileName('orders', range));
      },
      error: (err) => {
        this.exporting.set(false);
        this.feedback.error(errorMessage(err, 'Could not prepare the report.'));
      }
    });
  }
}

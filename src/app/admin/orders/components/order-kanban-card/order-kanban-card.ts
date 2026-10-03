import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { Order } from '../../../../core/models/order.model';
import { StatusPill } from '../../../components/status-pill/status-pill';

@Component({
  selector: 'app-order-kanban-card',
  imports: [DecimalPipe, StatusPill],
  templateUrl: './order-kanban-card.html',
  styleUrl: './order-kanban-card.scss'
})
export class OrderKanbanCard {
  readonly order = input.required<Order>();
  readonly isNew = input(false);
  readonly actionLabel = input<string | null>(null);
  readonly canCancel = input(false);
  readonly elapsedLabel = input('');
  readonly urgency = input<'normal' | 'amber' | 'red'>('normal');

  readonly primaryAction = output<void>();
  readonly cancel = output<void>();
  /** Staff saw the customer's UPI payment arrive. */
  readonly confirmPayment = output<void>();

  tableLabel(order: Order): string {
    return order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway';
  }

  addOnNames(addOns: { name: string }[]): string {
    return addOns.map((a) => a.name).join(', ');
  }
}

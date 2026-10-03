import { Order } from '../models/order.model';

export type ReportRange = 'today' | 'week' | 'month';

export function filterOrdersByRange(orders: Order[], range: ReportRange): Order[] {
  const now = new Date();
  let start: Date;

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return orders.filter((o) => new Date(o.createdAt) >= start);
}

export function ordersToCsv(orders: Order[]): string {
  const header = [
    'Order ID', 'Date', 'Time', 'Table', 'Customer Name', 'Phone',
    'Items', 'Subtotal', 'Service Charge', 'GST', 'Total', 'Status'
  ];

  const rows = orders.map((o) => {
    const date = new Date(o.createdAt);
    const itemsSummary = o.items
      .map((i) => `${i.qty}x ${i.itemName}${i.variantName ? ' (' + i.variantName + ')' : ''}`)
      .join('; ');

    return [
      o.id.slice(0, 8).toUpperCase(),
      date.toLocaleDateString('en-IN'),
      date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      o.tableNumber ?? '',
      o.customerName ?? '',
      o.customerPhone ?? '',
      itemsSummary,
      o.subtotal.toFixed(2),
      o.serviceChargeAmount.toFixed(2),
      o.gstAmount.toFixed(2),
      o.total.toFixed(2),
      o.status
    ];
  });

  const totalRow = ['', '', '', '', '', '', 'TOTAL', '', '', '', orders.reduce((sum, o) => sum + o.total, 0).toFixed(2), ''];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [header, ...rows, totalRow].map((row) => row.map((v) => escape(String(v))).join(',')).join('\r\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

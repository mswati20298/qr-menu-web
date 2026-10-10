import { InvoiceExportRow } from '../models/invoice.model';
import { MenuItem } from '../models/item.model';
import { Order } from '../models/order.model';

export type ReportRange = 'today' | 'week' | 'month' | 'lastMonth';

export const REPORT_RANGES: { value: ReportRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' }
];

/** The period in the browser's time zone (India for owners), as [from, to). */
export function rangeBounds(range: ReportRange, now = new Date()): { from: Date; to: Date } {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  switch (range) {
    case 'today':
      return { from: startOfDay(now), to: tomorrow };
    case 'week':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), to: tomorrow };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow };
    case 'lastMonth':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

/** Builds CSV text (Excel-friendly: every cell quoted, CRLF lines). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

const money = (n: number) => n.toFixed(2);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export function ordersToCsv(orders: Order[]): string {
  const rows = orders.map((o) => [
    o.id.slice(0, 8).toUpperCase(),
    day(o.createdAt),
    time(o.createdAt),
    o.tableNumber,
    o.customerName,
    o.customerPhone,
    o.items
      .map((i) => `${i.qty}x ${i.itemName}${i.variantName ? ' (' + i.variantName + ')' : ''}${i.addOns.length ? ' + ' + i.addOns.map((a) => a.name).join(', ') : ''}`)
      .join('; '),
    money(o.subtotal),
    money(o.serviceChargeAmount),
    money(o.gstAmount),
    money(o.total),
    o.status
  ]);
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  return toCsv(
    ['Order ID', 'Date', 'Time', 'Table', 'Customer Name', 'Phone', 'Items', 'Subtotal', 'Service Charge', 'GST', 'Total', 'Status'],
    [...rows, ['', '', '', '', '', '', 'TOTAL', '', '', '', money(total), '']]
  );
}

/** GST / sales report: one row per bill, with totals for the accountant. */
export function invoicesToCsv(invoices: InvoiceExportRow[]): string {
  const rows = invoices.map((i) => [
    i.number,
    day(i.createdAt),
    time(i.createdAt),
    i.tableNumber,
    i.customerName,
    i.customerPhone,
    i.ordersCount,
    money(i.subtotal),
    money(i.serviceChargeAmount),
    i.gstPercentage,
    money(i.gstAmount),
    money(i.total),
    i.paymentStatus,
    i.paymentMethods
  ]);
  const sum = (pick: (i: InvoiceExportRow) => number) => money(invoices.reduce((s, i) => s + pick(i), 0));
  return toCsv(
    ['Invoice No', 'Date', 'Time', 'Table', 'Customer', 'Phone', 'Orders', 'Subtotal', 'Service Charge', 'GST %', 'GST', 'Total', 'Payment', 'Paid by'],
    [...rows, ['TOTAL', '', '', '', '', '', '', sum((i) => i.subtotal), sum((i) => i.serviceChargeAmount), '', sum((i) => i.gstAmount), sum((i) => i.total), '', '']]
  );
}

/** The whole menu, one row per dish (sizes and add-ons in one cell each). */
export function menuToCsv(items: MenuItem[]): string {
  const rows = items.map((i) => [
    i.categoryName,
    i.name,
    i.description,
    money(i.price),
    i.isVeg ? 'Veg' : 'Non-veg',
    i.isAvailable ? 'Yes' : 'No',
    i.tag,
    i.variants.map((v) => `${v.name} ${money(v.price)}`).join('; '),
    i.addOns.map((a) => `${a.name} ${money(a.price)}`).join('; ')
  ]);
  return toCsv(['Category', 'Dish', 'Description', 'Price', 'Veg', 'Available', 'Tag', 'Sizes', 'Add-ons'], rows);
}

export function downloadCsv(csv: string, filename: string): void {
  // BOM so Excel opens ₹ and Hindi names correctly.
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** e.g. "orders-month-2026-10-09.csv" */
export function reportFileName(kind: string, range: ReportRange): string {
  return `${kind}-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
}

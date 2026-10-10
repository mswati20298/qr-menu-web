export type InvoicePaymentStatus = 'Paid' | 'Claimed' | 'PartlyPaid' | 'Unpaid';
export type InvoiceFormat = 'receipt' | 'a4';

export interface InvoiceLine {
  name: string;
  variant: string | null;
  addOns: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  createdAt: string;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  restaurantName: string;
  restaurantAddress: string | null;
  restaurantPhone: string | null;
  gstNumber: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  serviceChargePercentage: number;
  serviceChargeAmount: number;
  gstPercentage: number;
  gstAmount: number;
  total: number;
  paymentStatus: InvoicePaymentStatus;
  orderIds: string[];
}

export interface InvoiceSummary {
  id: string;
  number: string;
  createdAt: string;
  tableNumber: string | null;
  customerName: string | null;
  ordersCount: number;
  total: number;
  paymentStatus: InvoicePaymentStatus;
}

export interface InvoicePage {
  items: InvoiceSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const INVOICE_PAYMENT_LABELS: Record<InvoicePaymentStatus, string> = {
  Paid: 'Paid',
  Claimed: 'Payment claimed',
  PartlyPaid: 'Partly paid',
  Unpaid: 'Unpaid'
};

/** One bill as a row of the GST / sales report. */
export interface InvoiceExportRow {
  number: string;
  createdAt: string;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  ordersCount: number;
  subtotal: number;
  serviceChargeAmount: number;
  gstPercentage: number;
  gstAmount: number;
  total: number;
  paymentStatus: string;
  /** e.g. "Upi, Cash" */
  paymentMethods: string | null;
}

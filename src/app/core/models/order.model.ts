export type OrderStatus = 'Placed' | 'Preparing' | 'Served' | 'Completed' | 'Cancelled';

/** Unpaid → Claimed (customer says they paid by UPI) → Paid (staff confirmed). */
export type OrderPaymentStatus = 'Unpaid' | 'Claimed' | 'Paid';
export type StaffPaymentMethod = 'Cash' | 'Upi' | 'Card' | 'Other';

export interface OrderItemAddOn {
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  itemName: string;
  variantName: string | null;
  unitPrice: number;
  qty: number;
  addOns: OrderItemAddOn[];
  lineTotal: number;
}

export interface Order {
  id: string;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  status: OrderStatus;
  subtotal: number;
  serviceChargeAmount: number;
  gstAmount: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  paymentStatus: OrderPaymentStatus;
  /** UPI transaction id (UTR) the customer typed, if any. */
  paymentReference: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

export interface OrderItemInput {
  menuItemId: string;
  variantId: string | null;
  addOnIds: string[];
  qty: number;
}

export interface CreateOrderRequest {
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  skipServiceCharge: boolean;
  items: OrderItemInput[];
}

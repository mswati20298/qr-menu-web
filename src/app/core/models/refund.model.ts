export type RefundStatus = 'Requested' | 'Rejected' | 'Processing' | 'Refunded' | 'Failed';

/** A refund as both panels show it. Amounts in rupees. source: "online" (Razorpay) or "manual". */
export interface Refund {
  id: string;
  restaurantId: string;
  restaurantName: string;
  source: 'online' | 'manual';
  planName: string | null;
  paymentAmount: number;
  amount: number;
  status: RefundStatus;
  requestedBy: 'owner' | 'admin';
  reason: string | null;
  adminNote: string | null;
  decidedBy: string | null;
  gatewayRefundId: string | null;
  gatewayPaymentId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  refundedAt: string | null;
  /** Payment charges kept back (Razorpay does not return them). 0 when given back too, or for manual payments. */
  fee: number;
}

/** A paid plan the owner may still ask a refund for. */
export interface RefundablePayment {
  planPaymentId: string;
  planName: string;
  amount: number;
  /** Razorpay's charges, which are not refunded. */
  fee: number;
  /** What the owner gets back: amount - fee. */
  refundAmount: number;
  paidAt: string;
  refundableUntil: string;
}

export interface OwnerRefunds {
  refundable: RefundablePayment[];
  refunds: Refund[];
}

/** Owners can ask within this many days of paying (same as the API). */
export const REFUND_WINDOW_DAYS = 7;

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  Requested: 'Waiting for review',
  Rejected: 'Rejected',
  Processing: 'On its way',
  Refunded: 'Refunded',
  Failed: 'Failed'
};

/** Pill colour per status: matches the admin "soft" colour tokens. */
export const REFUND_STATUS_TONE: Record<RefundStatus, 'warning' | 'danger' | 'info' | 'success'> = {
  Requested: 'warning',
  Rejected: 'danger',
  Processing: 'info',
  Refunded: 'success',
  Failed: 'danger'
};

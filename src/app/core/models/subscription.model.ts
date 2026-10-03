export type SubscriptionPlan = 'Trial' | 'Free' | 'Paid';
export type SubscriptionStatus = 'Active' | 'Grace' | 'Expired' | 'Cancelled';
export type SubscriptionAction = 'TrialStarted' | 'FreeGranted' | 'PaymentRecorded' | 'Extended' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Upi' | 'BankTransfer' | 'Card' | 'Other' | 'Online';

/** Methods the super admin can record by hand. "Online" is only set by the payment gateway. */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Upi', label: 'UPI' },
  { value: 'BankTransfer', label: 'Bank transfer' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Other', label: 'Other' }
];

export interface SubscriptionSummary {
  plan: SubscriptionPlan;
  /** What people see: "Trial", "Free" or the bought plan's name. */
  planName: string;
  status: SubscriptionStatus;
  /** null = no end date (lifetime free). */
  expiresAt: string | null;
  graceEndsAt: string | null;
  cancelledAt: string | null;
  /** Days until ordering stops; null when it never does. */
  daysLeft: number | null;
  canTakeOrders: boolean;
  graceDays: number;
}

export interface SubscriptionEvent {
  id: string;
  action: SubscriptionAction;
  plan: SubscriptionPlan;
  planName: string;
  expiresAt: string | null;
  amount: number | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  note: string | null;
  performedBy: string;
  createdAt: string;
}

export interface SubscriptionDetails {
  restaurantId: string;
  restaurantName: string;
  current: SubscriptionSummary;
  history: SubscriptionEvent[];
}

export type OwnerPlanEvent = Omit<SubscriptionEvent, 'id' | 'plan' | 'note' | 'performedBy'>;

export interface OwnerPlan {
  current: SubscriptionSummary;
  history: OwnerPlanEvent[];
  /** Active catalog plans the owner can buy online. */
  availablePlans: PricingPlan[];
  onlinePaymentsEnabled: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  durationMonths: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PricingPlanAdmin extends PricingPlan {
  timesPurchased: number;
  createdAt: string;
  updatedAt: string;
}

export type SavePricingPlanRequest = Omit<PricingPlan, 'id'>;

/** Everything Razorpay checkout needs. amount is in paise. */
export interface Checkout {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
  restaurantName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  contact: string | null;
}

export interface ConfirmCheckoutRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export function durationLabel(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '1 year' : `${years} years`;
  }
  return months === 1 ? '1 month' : `${months} months`;
}

export interface GrantFreePlanRequest {
  lifetime: boolean;
  until: string | null;
  note: string | null;
}

export interface RecordPaymentRequest {
  pricingPlanId: string;
  periods: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  note: string | null;
}

export interface ExtendPlanRequest {
  until: string;
  note: string | null;
}

export const PLAN_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  Active: 'Active',
  Grace: 'In grace period',
  Expired: 'Expired',
  Cancelled: 'Cancelled'
};

export const ACTION_LABELS: Record<SubscriptionAction, string> = {
  TrialStarted: 'Free trial started',
  FreeGranted: 'Free plan given',
  PaymentRecorded: 'Payment received',
  Extended: 'Plan extended',
  Cancelled: 'Plan cancelled'
};

export function paymentMethodLabel(method: PaymentMethod | null): string {
  if (method === 'Online') {
    return 'Online';
  }
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? '—';
}

/** A yyyy-MM-dd date from an <input type="date">, as the end of that day in the browser's time zone (ISO, UTC). */
export function endOfLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

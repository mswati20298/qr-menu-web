import { RefundStatus } from './refund.model';

import { SubscriptionPlan, SubscriptionStatus } from './subscription.model';

export interface SuperAdminAuthResponse {
  token: string;
  name: string;
  /** Two-step login on: no token yet; send the 6-digit code with this challenge to verify-2fa. */
  requiresTwoFactor?: boolean;
  challengeToken?: string | null;
}

/** One change a super admin made (no request body is kept). */
export interface AdminAuditLogEntry {
  createdAt: string;
  adminEmail: string;
  /** e.g. "ApproveRefund", "ResetOwnerPassword" */
  action: string;
  path: string;
  targetId: string | null;
  statusCode: number;
  ipAddress: string | null;
}

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

export interface TwoFactorSetup {
  secret: string;
  otpAuthUri: string;
  qrPngDataUrl: string;
}

export interface SuperAdminRestaurant {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  whatsAppNumber: string | null;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  lastOrderAt: string | null;
  plan: SubscriptionPlan;
  planName: string;
  planStatus: SubscriptionStatus;
  planExpiresAt: string | null;
  /** Set when the super admin deleted it (soft delete); Restore clears it. */
  deletedAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SuperAdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  newRestaurantsLast30Days: number;
  totalOrders: number;
  ordersLast30Days: number;
  onTrial: number;
  paidPlans: number;
  expiringSoon: number;
  inGrace: number;
  orderingStopped: number;
  // Money the platform received for plans. Days and months are Indian time.
  revenueToday: number;
  revenueYesterday: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueAllTime: number;
  paymentsThisMonth: number;
  ordersToday: number;
  ordersYesterday: number;
  restaurantsOrderingToday: number;
  last30Days: PlatformDay[];
  last12Months: PlatformMonth[];
  recentPayments: RecentPayment[];
  renewalsDue: RenewalDue[];
  topRestaurants: TopRestaurant[];
}

export interface PlatformDay {
  date: string;
  revenue: number;
  payments: number;
  newRestaurants: number;
  orders: number;
}

/** month: "2026-10" */
export interface PlatformMonth {
  month: string;
  revenue: number;
  payments: number;
}

export interface RecentPayment {
  restaurantId: string;
  restaurantName: string;
  logoUrl: string | null;
  planName: string | null;
  amount: number;
  method: string | null;
  paidAt: string;
}

export interface RenewalDue {
  restaurantId: string;
  restaurantName: string;
  logoUrl: string | null;
  planName: string | null;
  plan: string;
  expiresAt: string;
}

export interface TopRestaurant {
  restaurantId: string;
  restaurantName: string;
  logoUrl: string | null;
  plan: string;
  ordersLast30Days: number;
}

/** Platform-wide settings. trialDays: free trial for new restaurants (0 = none). graceDays is read-only. */
export interface PlatformSettings {
  trialDays: number;
  graceDays: number;
  updatedAt: string;
  updatedBy: string | null;
}

/** A secret key as the panel sees it: never the value, only whether it is set, where from, and its last 4 characters. */
export interface SecretKeyStatus {
  isSet: boolean;
  /** 'panel' = saved here, 'server' = the server's .env file, 'none' = missing. */
  source: 'panel' | 'server' | 'none';
  lastFour: string | null;
}

export interface PlatformKeys {
  razorpayKeyId: string | null;
  razorpayKeyIdSource: 'panel' | 'server' | 'none';
  razorpayMode: 'test' | 'live' | 'none';
  razorpayKeySecret: SecretKeyStatus;
  razorpayWebhookSecret: SecretKeyStatus;
  geminiApiKey: SecretKeyStatus;
  webhookUrl: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** null = leave as it is, '' = remove the panel value (server value applies again), text = save it. */
export interface UpdatePlatformKeysRequest {
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  razorpayWebhookSecret?: string | null;
  geminiApiKey?: string | null;
}

export interface KeyCheckResult {
  ok: boolean;
  message: string;
}

export interface DemoStatus {
  isDemo: boolean;
  autoResetDays: number;
  lastResetAt: string | null;
  nextResetAt: string | null;
}

/** One plan payment in the super admin's log. */
export interface PaymentLogEntry {
  id: string;
  /** 'online' = Razorpay checkout; 'manual' = recorded by a super admin. */
  source: 'online' | 'manual';
  /** 'Paid', or 'Not completed' (checkout opened, never paid). */
  status: 'Paid' | 'Not completed';
  restaurantId: string;
  restaurantName: string;
  planName: string | null;
  amount: number;
  method: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  reference: string | null;
  note: string | null;
  performedBy: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Refunded so far, or on its way (rupees). */
  refundedAmount: number;
  /** Status of the latest refund for this payment, if any. */
  refundStatus: RefundStatus | null;
  /** Razorpay's charges a refund keeps back (saved from Razorpay, or an estimate). 0 for manual payments. */
  refundFee: number;
}

export interface PaymentLog {
  /** receivedTotal is before refunds; refundedTotal is what went back (or is on its way). */
  summary: {
    receivedTotal: number;
    paidCount: number;
    notCompletedCount: number;
    refundedTotal: number;
    openRefundRequests: number;
  };
  items: PaymentLogEntry[];
}

/** One message to or from Razorpay for an order (raw JSON bodies). */
export interface PaymentGatewayLogEntry {
  /** 'order.create' | 'checkout.confirm' | 'webhook' | 'result' */
  kind: string;
  statusCode: number | null;
  requestBody: string | null;
  responseBody: string | null;
  note: string | null;
  createdAt: string;
}

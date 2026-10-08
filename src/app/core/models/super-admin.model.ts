import { SubscriptionPlan, SubscriptionStatus } from './subscription.model';

export interface SuperAdminAuthResponse {
  token: string;
  name: string;
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

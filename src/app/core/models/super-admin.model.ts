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
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminAuditLogEntry,
  DemoStatus,
  KeyCheckResult,
  PagedResult,
  PaymentGatewayLogEntry,
  PaymentLog,
  PlatformKeys,
  PlatformSettings,
  SuperAdminRestaurant,
  SuperAdminStats,
  TwoFactorSetup,
  TwoFactorStatus,
  UpdatePlatformKeysRequest
} from '../models/super-admin.model';
import {
  ExtendPlanRequest,
  GrantFreePlanRequest,
  PricingPlanAdmin,
  RecordPaymentRequest,
  SavePricingPlanRequest,
  SubscriptionDetails
} from '../models/subscription.model';
import { Refund } from '../models/refund.model';

/** Refund a payment: online ones go back through Razorpay, manual ones are only recorded. */
export interface AdminRefundRequest {
  planPaymentId: string | null;
  paymentEventId: string | null;
  amount: number | null;
  note: string | null;
  /** Give Razorpay's charges back too (charged twice, our mistake). */
  includeFee: boolean;
}

export type PlanFilter = '' | 'trial' | 'free' | 'paid' | 'expiring' | 'grace' | 'stopped';

export interface RestaurantQuery {
  search?: string;
  status?: 'active' | 'suspended' | '';
  plan?: PlanFilter;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private readonly baseUrl = `${environment.apiBaseUrl}/superadmin`;

  constructor(private readonly http: HttpClient) {}

  stats(): Observable<SuperAdminStats> {
    return this.http.get<SuperAdminStats>(`${this.baseUrl}/stats`);
  }

  restaurants(query: RestaurantQuery): Observable<PagedResult<SuperAdminRestaurant>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.plan) {
      params = params.set('plan', query.plan);
    }
    return this.http.get<PagedResult<SuperAdminRestaurant>>(`${this.baseUrl}/restaurants`, { params });
  }

  setStatus(id: string, isActive: boolean): Observable<SuperAdminRestaurant> {
    return this.http.put<SuperAdminRestaurant>(`${this.baseUrl}/restaurants/${id}/status`, { isActive });
  }

  /** New temporary owner password, returned only once. All the owner's logins are signed out. */
  resetOwnerPassword(id: string): Observable<{ ownerEmail: string; temporaryPassword: string }> {
    return this.http.post<{ ownerEmail: string; temporaryPassword: string }>(`${this.baseUrl}/restaurants/${id}/reset-password`, {});
  }

  subscription(id: string): Observable<SubscriptionDetails> {
    return this.http.get<SubscriptionDetails>(`${this.baseUrl}/restaurants/${id}/subscription`);
  }

  grantFree(id: string, request: GrantFreePlanRequest): Observable<SubscriptionDetails> {
    return this.http.post<SubscriptionDetails>(`${this.baseUrl}/restaurants/${id}/subscription/free`, request);
  }

  recordPayment(id: string, request: RecordPaymentRequest): Observable<SubscriptionDetails> {
    return this.http.post<SubscriptionDetails>(`${this.baseUrl}/restaurants/${id}/subscription/payment`, request);
  }

  extend(id: string, request: ExtendPlanRequest): Observable<SubscriptionDetails> {
    return this.http.post<SubscriptionDetails>(`${this.baseUrl}/restaurants/${id}/subscription/extend`, request);
  }

  cancel(id: string, note: string | null): Observable<SubscriptionDetails> {
    return this.http.post<SubscriptionDetails>(`${this.baseUrl}/restaurants/${id}/subscription/cancel`, { note });
  }

  settings(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(trialDays: number): Observable<PlatformSettings> {
    return this.http.put<PlatformSettings>(`${this.baseUrl}/settings`, { trialDays });
  }

  keys(): Observable<PlatformKeys> {
    return this.http.get<PlatformKeys>(`${this.baseUrl}/settings/keys`);
  }

  updateKeys(request: UpdatePlatformKeysRequest): Observable<PlatformKeys> {
    return this.http.put<PlatformKeys>(`${this.baseUrl}/settings/keys`, request);
  }

  /** Empty fields are checked with the keys in use now. */
  testRazorpay(keyId: string | null, keySecret: string | null): Observable<KeyCheckResult> {
    return this.http.post<KeyCheckResult>(`${this.baseUrl}/settings/keys/test-razorpay`, { keyId, keySecret });
  }

  /** status: '' (all), 'paid' or 'unpaid' (checkout opened, not paid). */
  payments(status: '' | 'paid' | 'unpaid', search: string): Observable<PaymentLog> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    if (search.trim()) params['search'] = search.trim();
    return this.http.get<PaymentLog>(`${this.baseUrl}/payments`, { params });
  }

  /** status: '' for all, or one RefundStatus (e.g. 'Requested'). */
  refunds(status = ''): Observable<Refund[]> {
    return this.http.get<Refund[]>(`${this.baseUrl}/refunds`, { params: status ? { status } : {} });
  }

  /** amount null = everything that is left, less Razorpay's charges (unless includeFee). */
  approveRefund(id: string, amount: number | null, note: string | null, includeFee: boolean): Observable<Refund> {
    return this.http.post<Refund>(`${this.baseUrl}/refunds/${id}/approve`, { amount, note, includeFee });
  }

  rejectRefund(id: string, note: string): Observable<Refund> {
    return this.http.post<Refund>(`${this.baseUrl}/refunds/${id}/reject`, { note });
  }

  refundPayment(request: AdminRefundRequest): Observable<Refund> {
    return this.http.post<Refund>(`${this.baseUrl}/refunds`, request);
  }

  gatewayLog(orderId: string): Observable<PaymentGatewayLogEntry[]> {
    return this.http.get<PaymentGatewayLogEntry[]>(`${this.baseUrl}/payments/gateway-log`, { params: { orderId } });
  }

  /** What super admins changed recently, newest first. */
  auditLog(take = 100): Observable<AdminAuditLogEntry[]> {
    return this.http.get<AdminAuditLogEntry[]>(`${this.baseUrl}/audit`, { params: { take } });
  }

  twoFactorStatus(): Observable<TwoFactorStatus> {
    return this.http.get<TwoFactorStatus>(`${this.baseUrl}/2fa`);
  }

  twoFactorSetup(): Observable<TwoFactorSetup> {
    return this.http.post<TwoFactorSetup>(`${this.baseUrl}/2fa/setup`, {});
  }

  twoFactorEnable(code: string): Observable<{ recoveryCodes: string[] }> {
    return this.http.post<{ recoveryCodes: string[] }>(`${this.baseUrl}/2fa/enable`, { code });
  }

  twoFactorNewRecoveryCodes(code: string): Observable<{ recoveryCodes: string[] }> {
    return this.http.post<{ recoveryCodes: string[] }>(`${this.baseUrl}/2fa/recovery-codes`, { code });
  }

  twoFactorDisable(password: string, code: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/2fa/disable`, { password, code });
  }

  demoStatus(): Observable<DemoStatus> {
    return this.http.get<DemoStatus>(`${this.baseUrl}/demo`);
  }

  updateDemo(autoResetDays: number): Observable<DemoStatus> {
    return this.http.put<DemoStatus>(`${this.baseUrl}/demo`, { autoResetDays });
  }

  resetDemo(): Observable<DemoStatus> {
    return this.http.post<DemoStatus>(`${this.baseUrl}/demo/reset`, {});
  }

  plans(): Observable<PricingPlanAdmin[]> {
    return this.http.get<PricingPlanAdmin[]>(`${this.baseUrl}/plans`);
  }

  createPlan(request: SavePricingPlanRequest): Observable<PricingPlanAdmin> {
    return this.http.post<PricingPlanAdmin>(`${this.baseUrl}/plans`, request);
  }

  updatePlan(id: string, request: SavePricingPlanRequest): Observable<PricingPlanAdmin> {
    return this.http.put<PricingPlanAdmin>(`${this.baseUrl}/plans/${id}`, request);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/plans/${id}`);
  }
}

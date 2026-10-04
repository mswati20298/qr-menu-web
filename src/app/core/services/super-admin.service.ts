import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult, PlatformSettings, SuperAdminRestaurant, SuperAdminStats } from '../models/super-admin.model';
import {
  ExtendPlanRequest,
  GrantFreePlanRequest,
  PricingPlanAdmin,
  RecordPaymentRequest,
  SavePricingPlanRequest,
  SubscriptionDetails
} from '../models/subscription.model';

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

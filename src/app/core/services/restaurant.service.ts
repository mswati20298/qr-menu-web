import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OwnerRefunds, Refund } from '../models/refund.model';
import { DashboardStats, Restaurant, ScanStats, UpdateRestaurantRequest } from '../models/restaurant.model';
import { Checkout, ConfirmCheckoutRequest, OwnerPlan, SubscriptionSummary } from '../models/subscription.model';

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private readonly baseUrl = `${environment.apiBaseUrl}/restaurant`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<Restaurant> {
    return this.http.get<Restaurant>(this.baseUrl);
  }

  update(request: UpdateRestaurantRequest): Observable<Restaurant> {
    return this.http.put<Restaurant>(this.baseUrl, request);
  }

  getScanStats(days = 7): Observable<ScanStats[]> {
    return this.http.get<ScanStats[]>(`${this.baseUrl}/scan-stats?days=${days}`);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard-stats`);
  }

  /** pin = 4–8 digits, or null to turn the separate kitchen login off. Changing it signs every kitchen screen out. */
  setKitchenPin(pin: string | null): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.baseUrl}/kitchen-pin`, { pin });
  }

  /** subdomain = "saket" for saket.qrenvo.com, or null to remove it. */
  setSubdomain(subdomain: string | null): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.baseUrl}/subdomain`, { subdomain });
  }

  /** The current plan, shared by the plan banner (every admin page) and My plan; updated by every plan read. */
  readonly currentPlan = signal<SubscriptionSummary | null>(null);

  getPlan(): Observable<OwnerPlan> {
    return this.http.get<OwnerPlan>(`${this.baseUrl}/plan`).pipe(tap((plan) => this.currentPlan.set(plan.current)));
  }

  startCheckout(pricingPlanId: string): Observable<Checkout> {
    return this.http.post<Checkout>(`${this.baseUrl}/plan/checkout`, { pricingPlanId });
  }

  confirmCheckout(request: ConfirmCheckoutRequest): Observable<OwnerPlan> {
    return this.http.post<OwnerPlan>(`${this.baseUrl}/plan/confirm`, request).pipe(tap((plan) => this.currentPlan.set(plan.current)));
  }

  getRefunds(): Observable<OwnerRefunds> {
    return this.http.get<OwnerRefunds>(`${this.baseUrl}/plan/refunds`);
  }

  requestRefund(planPaymentId: string, reason: string): Observable<Refund> {
    return this.http.post<Refund>(`${this.baseUrl}/plan/refunds`, { planPaymentId, reason });
  }
}

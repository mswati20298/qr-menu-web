import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, Restaurant, ScanStats, UpdateRestaurantRequest } from '../models/restaurant.model';
import { Checkout, ConfirmCheckoutRequest, OwnerPlan } from '../models/subscription.model';

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

  getPlan(): Observable<OwnerPlan> {
    return this.http.get<OwnerPlan>(`${this.baseUrl}/plan`);
  }

  startCheckout(pricingPlanId: string): Observable<Checkout> {
    return this.http.post<Checkout>(`${this.baseUrl}/plan/checkout`, { pricingPlanId });
  }

  confirmCheckout(request: ConfirmCheckoutRequest): Observable<OwnerPlan> {
    return this.http.post<OwnerPlan>(`${this.baseUrl}/plan/confirm`, request);
  }
}

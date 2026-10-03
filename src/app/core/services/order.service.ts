import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, Order, StaffPaymentMethod } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private readonly http: HttpClient) {}

  // --- Public (customer-facing) ---

  createOrder(slug: string, request: CreateOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${environment.apiBaseUrl}/public/${slug}/orders`, request);
  }

  getOrdersByPhone(slug: string, phone: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${environment.apiBaseUrl}/public/${slug}/orders?phone=${encodeURIComponent(phone)}`);
  }

  getPublicOrder(slug: string, orderId: string): Observable<Order> {
    return this.http.get<Order>(`${environment.apiBaseUrl}/public/${slug}/orders/${orderId}`);
  }

  cancelOrder(slug: string, orderId: string): Observable<Order> {
    return this.http.patch<Order>(`${environment.apiBaseUrl}/public/${slug}/orders/${orderId}/cancel`, {});
  }

  /** Customer says they paid by UPI; staff still confirms. reference = UPI transaction id (optional). */
  claimPayment(slug: string, orderId: string, reference: string | null): Observable<Order> {
    return this.http.post<Order>(`${environment.apiBaseUrl}/public/${slug}/orders/${orderId}/payment-claim`, { reference });
  }

  // --- Owner (admin dashboard) ---

  getAllForOwner(status?: string): Observable<Order[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.http.get<Order[]>(`${environment.apiBaseUrl}/orders${query}`);
  }

  getForOwner(id: string): Observable<Order> {
    return this.http.get<Order>(`${environment.apiBaseUrl}/orders/${id}`);
  }

  updateStatus(id: string, status: string): Observable<Order> {
    return this.http.patch<Order>(`${environment.apiBaseUrl}/orders/${id}/status`, { status });
  }

  /** Staff confirms a payment ('Paid' + method) or rejects a customer's claim ('Unpaid'). */
  updatePayment(id: string, status: 'Paid' | 'Unpaid', method: StaffPaymentMethod | null = null): Observable<Order> {
    return this.http.patch<Order>(`${environment.apiBaseUrl}/orders/${id}/payment`, { status, method, reference: null });
  }

  getNewOrdersSince(since: Date): Observable<Order[]> {
    return this.http.get<Order[]>(`${environment.apiBaseUrl}/orders/notifications?since=${since.toISOString()}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CustomerReviewSummary, Review, ReviewInput } from '../models/review.model';

/** Ratings: guests rate their order, owners rate QRenvo, the super admin picks what the landing page shows. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  // Guests (no login).
  forOrder(slug: string, orderId: string): Observable<Review | null> {
    return this.http.get<Review | null>(`${this.api}/public/${slug}/orders/${orderId}/feedback`, { observe: 'response' })
      .pipe(map((res) => (res.status === 204 ? null : res.body)));
  }

  submitForOrder(slug: string, orderId: string, input: ReviewInput): Observable<Review> {
    return this.http.post<Review>(`${this.api}/public/${slug}/orders/${orderId}/feedback`, input);
  }

  uploadGuestPhoto(slug: string, orderId: string, file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.api}/public/${slug}/orders/${orderId}/feedback/image`, form);
  }

  // Restaurant owner.
  customerReviews(): Observable<CustomerReviewSummary> {
    return this.http.get<CustomerReviewSummary>(`${this.api}/restaurant/feedback/customers`);
  }

  myReview(): Observable<Review | null> {
    return this.http.get<Review | null>(`${this.api}/restaurant/feedback/mine`, { observe: 'response' })
      .pipe(map((res) => (res.status === 204 ? null : res.body)));
  }

  saveMyReview(input: ReviewInput): Observable<Review> {
    return this.http.put<Review>(`${this.api}/restaurant/feedback/mine`, input);
  }

  // Super admin.
  all(kind: '' | 'owner' | 'customer' = ''): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.api}/superadmin/feedback`, { params: kind ? { kind } : {} });
  }

  setPublished(id: string, isPublished: boolean): Observable<Review> {
    return this.http.put<Review>(`${this.api}/superadmin/feedback/${id}/publish`, { isPublished });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/superadmin/feedback/${id}`);
  }
}

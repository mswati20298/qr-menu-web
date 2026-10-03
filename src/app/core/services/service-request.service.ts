import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceRequest, ServiceRequestType } from '../models/service-request.model';

@Injectable({ providedIn: 'root' })
export class ServiceRequestService {
  constructor(private readonly http: HttpClient) {}

  /** Customer side (no login). */
  send(slug: string, tableNumber: string, type: ServiceRequestType): Observable<ServiceRequest> {
    return this.http.post<ServiceRequest>(`${environment.apiBaseUrl}/public/${slug}/requests`, { tableNumber, type });
  }

  /** Owner side: requests waiting for staff, oldest first. */
  listPending(): Observable<ServiceRequest[]> {
    return this.http.get<ServiceRequest[]>(`${environment.apiBaseUrl}/requests`);
  }

  complete(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/requests/${id}/complete`, {});
  }
}

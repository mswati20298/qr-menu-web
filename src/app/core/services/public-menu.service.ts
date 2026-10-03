import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicMenuResponse } from '../models/public-menu.model';

@Injectable({ providedIn: 'root' })
export class PublicMenuService {
  constructor(private readonly http: HttpClient) {}

  getMenu(slug: string): Observable<PublicMenuResponse> {
    return this.http.get<PublicMenuResponse>(`${environment.apiBaseUrl}/public/${slug}/menu`);
  }

  logScan(slug: string, table: string | null): Observable<void> {
    const query = table ? `?table=${encodeURIComponent(table)}` : '';
    return this.http.post<void>(`${environment.apiBaseUrl}/public/${slug}/scan${query}`, {});
  }
}

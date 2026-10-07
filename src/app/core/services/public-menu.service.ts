import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicMenuResponse, TableSession } from '../models/public-menu.model';

@Injectable({ providedIn: 'root' })
export class PublicMenuService {
  constructor(private readonly http: HttpClient) {}

  getMenu(slug: string): Observable<PublicMenuResponse> {
    return this.http.get<PublicMenuResponse>(`${environment.apiBaseUrl}/public/${slug}/menu`);
  }

  /** Checks the secret code from a table's QR and starts a time-limited table session for this phone. */
  startTableSession(slug: string, table: string, code: string): Observable<TableSession> {
    return this.http.post<TableSession>(`${environment.apiBaseUrl}/public/${slug}/table-session`, { table, code });
  }

  logScan(slug: string, table: string | null): Observable<void> {
    const query = table ? `?table=${encodeURIComponent(table)}` : '';
    return this.http.post<void>(`${environment.apiBaseUrl}/public/${slug}/scan${query}`, {});
  }
}

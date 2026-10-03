import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QrService {
  constructor(private readonly http: HttpClient) {}

  downloadQrPdf(slug: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/qr/${slug}`, {
      responseType: 'blob'
    });
  }

  getTableQrPng(slug: string, tableNumber: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/qr/${slug}/table/${encodeURIComponent(tableNumber)}`, {
      responseType: 'blob'
    });
  }
}

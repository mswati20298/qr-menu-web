import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Invoice, InvoiceFormat, InvoicePage } from '../models/invoice.model';
import { StaffPaymentMethod } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/invoices`;

  constructor(private readonly http: HttpClient) {}

  list(search: string, page: number, pageSize = 20): Observable<InvoicePage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<InvoicePage>(this.baseUrl, { params });
  }

  get(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.baseUrl}/${id}`);
  }

  /** Bills one order (returns its existing invoice if it already has one). */
  createForOrder(orderId: string): Observable<Invoice> {
    return this.http.post<Invoice>(this.baseUrl, { orderId, tableNumber: null });
  }

  /** Bills every open, unbilled order at the table from the last 24 hours. */
  createForTable(tableNumber: string): Observable<Invoice> {
    return this.http.post<Invoice>(this.baseUrl, { orderId: null, tableNumber });
  }

  markPaid(id: string, method: StaffPaymentMethod): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/${id}/mark-paid`, { method, reference: null });
  }

  /** Fetches the PDF with the login token (a plain link would not carry it). */
  pdf(id: string, format: InvoiceFormat): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/${id}/pdf?format=${format}`, { responseType: 'blob' }));
  }

  async download(invoice: { id: string; number: string }, format: InvoiceFormat): Promise<void> {
    const url = URL.createObjectURL(await this.pdf(invoice.id, format));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.number}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /** Opens the browser's print dialog for the invoice PDF, without leaving the page. */
  async print(invoice: { id: string }, format: InvoiceFormat): Promise<void> {
    const url = URL.createObjectURL(await this.pdf(invoice.id, format));
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        // Some browsers block printing a PDF from a frame: open it in a new tab instead.
        window.open(url, '_blank');
      }
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };
    document.body.appendChild(frame);
  }
}

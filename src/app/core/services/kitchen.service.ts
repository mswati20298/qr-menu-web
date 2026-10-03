import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KitchenBoard, KitchenOrder } from '../models/kitchen.model';

@Injectable({ providedIn: 'root' })
export class KitchenService {
  private readonly baseUrl = `${environment.apiBaseUrl}/kitchen`;

  constructor(private readonly http: HttpClient) {}

  board(): Observable<KitchenBoard> {
    return this.http.get<KitchenBoard>(`${this.baseUrl}/orders`);
  }

  /** New → Preparing → Served. */
  advance(id: string): Observable<KitchenOrder> {
    return this.http.post<KitchenOrder>(`${this.baseUrl}/orders/${id}/advance`, {});
  }

  /** One step back, to undo a mis-tap. */
  revert(id: string): Observable<KitchenOrder> {
    return this.http.post<KitchenOrder>(`${this.baseUrl}/orders/${id}/revert`, {});
  }
}

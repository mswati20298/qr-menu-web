import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateItemRequest, MenuItem, UpdateItemRequest } from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly baseUrl = `${environment.apiBaseUrl}/items`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(this.baseUrl);
  }

  create(request: CreateItemRequest): Observable<MenuItem> {
    return this.http.post<MenuItem>(this.baseUrl, request);
  }

  update(id: string, request: UpdateItemRequest): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  setAvailability(id: string, isAvailable: boolean): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`${this.baseUrl}/${id}/availability`, { isAvailable });
  }

  reorder(categoryId: string, orderedIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reorder?categoryId=${categoryId}`, orderedIds);
  }
}

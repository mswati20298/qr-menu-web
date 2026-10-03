import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTableRequest, RestaurantTable, UpdateTableRequest } from '../models/table.model';

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tables`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<RestaurantTable[]> {
    return this.http.get<RestaurantTable[]>(this.baseUrl);
  }

  create(request: CreateTableRequest): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(this.baseUrl, request);
  }

  update(id: string, request: UpdateTableRequest): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

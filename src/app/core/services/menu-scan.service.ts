import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuScanResult } from '../models/menu-scan.model';

@Injectable({ providedIn: 'root' })
export class MenuScanService {
  private readonly baseUrl = `${environment.apiBaseUrl}/menu-scan`;

  constructor(private readonly http: HttpClient) {}

  scan(files: File[]): Observable<MenuScanResult> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return this.http.post<MenuScanResult>(this.baseUrl, formData);
  }
}

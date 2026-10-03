import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface UploadResponse {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private readonly http: HttpClient) {}

  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${environment.apiBaseUrl}/uploads/image`, formData);
  }

  resolveUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }
    return url.startsWith('http') ? url : `${environment.apiOrigin}${url}`;
  }
}

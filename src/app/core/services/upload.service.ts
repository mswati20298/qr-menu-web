import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ImagePurpose = 'item' | 'background' | 'logo';

interface UploadResponse {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private readonly http: HttpClient) {}

  /**
   * The server checks the file, fixes the phone's rotation, removes hidden data (GPS) and shrinks it to what
   * the screen needs: background 1920 px, dish photo 1200 px, logo 512 px on the longest side.
   */
  uploadImage(file: File, purpose: ImagePurpose = 'item'): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${environment.apiBaseUrl}/uploads/image?purpose=${purpose}`, formData);
  }

  resolveUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }
    return url.startsWith('http') ? url : `${environment.apiOrigin}${url}`;
  }
}

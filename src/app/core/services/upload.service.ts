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

  /**
   * A small copy of one of our uploaded photos, for lists and thumbnails (the server makes each size once and
   * it is then cached). 320 suits a ~100 px box on a sharp phone screen. Other URLs are returned as they are.
   */
  thumbUrl(url: string | null | undefined, width: 160 | 320 | 640 = 320): string | null {
    if (!url) {
      return null;
    }
    const match = /^\/uploads\/([0-9a-fA-F-]{36}\.(?:jpg|jpeg|png|webp))$/.exec(url);
    return match ? `${environment.apiOrigin}/uploads/w${width}/${match[1]}` : this.resolveUrl(url);
  }
}

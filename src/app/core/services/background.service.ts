import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackgroundMode, BackgroundSettings } from '../models/background.model';

/** Owner-side API for the restaurant's background images.
 * Keeps the latest settings in a signal so the admin layout (and anything else)
 * updates immediately after a change in Settings. */
@Injectable({ providedIn: 'root' })
export class BackgroundService {
  private readonly baseUrl = `${environment.apiBaseUrl}/backgrounds`;
  private readonly state = signal<BackgroundSettings | null>(null);

  /** null until the first load finishes. */
  readonly settings = this.state.asReadonly();

  constructor(private readonly http: HttpClient) {}

  load(): Observable<BackgroundSettings> {
    return this.http.get<BackgroundSettings>(this.baseUrl).pipe(tap((settings) => this.state.set(settings)));
  }

  add(imageUrl: string): Observable<BackgroundSettings> {
    return this.http.post(this.baseUrl, { imageUrl }).pipe(switchMap(() => this.load()));
  }

  update(id: string, slots: number, isDefault: boolean): Observable<BackgroundSettings> {
    return this.http.put(`${this.baseUrl}/${id}`, { slots, isDefault }).pipe(switchMap(() => this.load()));
  }

  setMode(mode: BackgroundMode): Observable<BackgroundSettings> {
    return this.http.put(`${this.baseUrl}/mode`, { mode }).pipe(switchMap(() => this.load()));
  }

  remove(id: string): Observable<BackgroundSettings> {
    return this.http.delete(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }
}

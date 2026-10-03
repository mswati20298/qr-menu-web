import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KitchenAuthResponse } from '../models/kitchen.model';

const TOKEN_KEY = 'qrmenu_kitchen_token';
const SLUG_KEY = 'qrmenu_kitchen_slug';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Kitchen-screen login (restaurant link + PIN). Kept apart from the owner's login: this token can only
 * reach the kitchen API, so a shared kitchen tablet never holds the owner's session.
 */
@Injectable({ providedIn: 'root' })
export class KitchenAuthService {
  private readonly token = signal<string | null>(read(TOKEN_KEY));

  readonly isAuthenticated = computed(() => this.token() !== null);

  constructor(private readonly http: HttpClient) {}

  getToken(): string | null {
    return this.token();
  }

  /** The restaurant last used on this device, to pre-fill the login form. */
  lastSlug(): string {
    return read(SLUG_KEY) ?? '';
  }

  login(slug: string, pin: string): Observable<KitchenAuthResponse> {
    return this.http.post<KitchenAuthResponse>(`${environment.apiBaseUrl}/kitchen/auth/login`, { slug, pin }).pipe(
      tap((response) => {
        try {
          localStorage.setItem(TOKEN_KEY, response.token);
          localStorage.setItem(SLUG_KEY, response.restaurantSlug);
        } catch {
          // Private mode: the session lasts until the tab closes.
        }
        this.token.set(response.token);
      })
    );
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    this.token.set(null);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SuperAdminAuthResponse } from '../models/super-admin.model';

// Separate keys from the restaurant owner session, so the two can never be mixed up.
const TOKEN_KEY = 'qrmenu_superadmin_token';
const NAME_KEY = 'qrmenu_superadmin_name';

@Injectable({ providedIn: 'root' })
export class SuperAdminAuthService {
  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly adminName = signal<string | null>(localStorage.getItem(NAME_KEY));

  readonly isAuthenticated = computed(() => this.token() !== null);
  readonly name = computed(() => this.adminName());

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  login(email: string, password: string): Observable<SuperAdminAuthResponse> {
    return this.http
      .post<SuperAdminAuthResponse>(`${environment.apiBaseUrl}/superadmin/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          localStorage.setItem(TOKEN_KEY, response.token);
          localStorage.setItem(NAME_KEY, response.name);
          this.token.set(response.token);
          this.adminName.set(response.name);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    this.token.set(null);
    this.adminName.set(null);
    this.router.navigate(['/superadmin/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
}

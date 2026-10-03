import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { setLoginNotice } from '../login-notice';
import { AuthService } from '../services/auth.service';
import { KitchenAuthService } from '../services/kitchen-auth.service';
import { SuperAdminAuthService } from '../services/super-admin-auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const superAdminAuth = inject(SuperAdminAuthService);
  const kitchenAuth = inject(KitchenAuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isSuperAdminCall = req.url.includes('/api/superadmin/') && !req.url.includes('/api/superadmin/auth/');

      if (isSuperAdminCall) {
        // Expired or rejected super admin token: back to the super admin login.
        if (error.status === 401 || error.status === 403) {
          superAdminAuth.logout();
        }
        return throwError(() => error);
      }

      const isKitchenCall = req.url.includes('/api/kitchen/') && !req.url.includes('/api/kitchen/auth/');
      if (isKitchenCall) {
        // Kitchen screen signed out (PIN changed, token expired, restaurant suspended).
        // Only the kitchen session ends; an owner signed in on the same device stays signed in.
        if (error.status === 401 || error.status === 403) {
          if (kitchenAuth.isAuthenticated()) {
            kitchenAuth.logout();
            setLoginNotice(error.error?.message ?? 'Please sign in to the kitchen screen again.');
            router.navigate(['/kitchen/login']);
          } else if (error.status === 401) {
            authService.logout();
            router.navigate(['/admin/login']);
          }
        }
        return throwError(() => error);
      }

      if (error.status === 401 && req.url.includes('/api/') && !req.url.includes('/api/auth/')) {
        authService.logout();
        router.navigate(['/admin/login']);
      }

      // The super admin suspended this restaurant while the owner was signed in.
      if (
        error.status === 403 &&
        error.error?.code === 'restaurant_suspended' &&
        req.url.includes('/api/') &&
        !req.url.includes('/api/auth/') &&
        !req.url.includes('/api/public/')
      ) {
        setLoginNotice(error.error?.message ?? 'This restaurant account is suspended. Please contact support.');
        authService.logout();
      }

      return throwError(() => error);
    })
  );
};

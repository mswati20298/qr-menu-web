import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { KitchenAuthService } from '../services/kitchen-auth.service';
import { SuperAdminAuthService } from '../services/super-admin-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Super admin API: only ever the super admin token (never the restaurant owner's).
  if (req.url.includes('/api/superadmin/')) {
    if (!req.url.includes('/api/superadmin/auth/')) {
      const adminToken = inject(SuperAdminAuthService).getToken();
      if (adminToken) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${adminToken}` } });
      }
    }
    return next(req);
  }

  const authService = inject(AuthService);

  // Kitchen API: the kitchen-screen token if this device signed in with the PIN, otherwise the owner's.
  if (req.url.includes('/api/kitchen/')) {
    if (!req.url.includes('/api/kitchen/auth/')) {
      const kitchenToken = inject(KitchenAuthService).getToken() ?? authService.getToken();
      if (kitchenToken) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${kitchenToken}` } });
      }
    }
    return next(req);
  }

  const token = authService.getToken();

  if (token && req.url.includes('/api/') && !req.url.includes('/api/auth/') && !req.url.includes('/api/public/')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { KitchenAuthService } from '../services/kitchen-auth.service';

/** The kitchen screen opens with a kitchen-PIN session or with the owner's own login. */
export const kitchenGuard: CanActivateFn = () => {
  if (inject(KitchenAuthService).isAuthenticated() || inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/kitchen/login']);
};

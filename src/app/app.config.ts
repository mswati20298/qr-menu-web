import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter, withPreloading, withViewTransitions } from '@angular/router';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { routes } from './app.routes';
import { SelectivePreloadStrategy } from './core/preload-strategy';
import { SiteService } from './core/services/site.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Page changes cross-fade (browsers without View Transitions just switch instantly).
    provideRouter(routes, withPreloading(SelectivePreloadStrategy), withViewTransitions({ skipInitialTransition: true })),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAppInitializer(() => inject(SiteService).init())
  ]
};

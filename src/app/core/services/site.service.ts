import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** What this deployment is (Demo or Prod) and, on a restaurant's own address, which restaurant. */
export interface SiteInfo {
  environment: 'Demo' | 'Prod';
  isDemo: boolean;
  rootDomain: string | null;
  appUrl: string;
  restaurantSlug: string | null;
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly http = inject(HttpClient);
  readonly info = signal<SiteInfo | null>(null);

  /**
   * Runs once before the first route. On saket.qrenvo.com it shows that restaurant's menu, and sends anyone
   * opening the owner panel, kitchen or super admin there to the main app address instead.
   */
  async init(): Promise<void> {
    try {
      const info = await firstValueFrom(this.http.get<SiteInfo>(`${environment.apiBaseUrl}/public/site`));
      this.info.set(info);

      const slug = info.restaurantSlug;
      if (!slug) {
        return;
      }

      const { pathname, search, hash } = window.location;
      if (/^\/(admin|superadmin|kitchen)(\/|$)/.test(pathname)) {
        window.location.replace(`${info.appUrl}${pathname}${search}${hash}`);
        return;
      }

      if (!pathname.startsWith(`/m/${slug}`)) {
        // Rewrite the address before the router reads it: "/?t=5" becomes "/m/{slug}/menu?t=5".
        history.replaceState(null, '', `/m/${slug}/menu${search}${hash}`);
      }
    } catch {
      // The menu still works without this; it only adds the Demo ribbon and subdomain routing.
    }
  }
}

import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Loads the code of routes marked `data: { preload: true }` in the background once the first page is up.
 * Used for the customer menu's tabs: without it the first tap on "My orders" or "Cart" waits for that
 * page's code to download, nothing seems to happen, and guests tap again.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] ? load() : of(null);
  }
}

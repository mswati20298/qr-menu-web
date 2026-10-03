import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'qrmenu_theme';

/** Light / dark mode for the whole app.
 *
 * - Until the user picks a theme with the toggle, we follow the browser / OS setting
 *   (prefers-color-scheme) and keep following it if it changes.
 * - Once the user toggles, their choice is saved and always wins.
 * Applied as <html data-theme="light|dark">, which the global theme stylesheet reads. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media: MediaQueryList | null =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  readonly mode = signal<ThemeMode>(this.readStored() ?? this.systemMode());

  constructor() {
    this.apply(this.mode());

    // Follow live browser/OS theme changes, but only while the user hasn't chosen one.
    this.media?.addEventListener('change', () => {
      if (!this.readStored()) {
        const mode = this.systemMode();
        this.mode.set(mode);
        this.apply(mode);
      }
    });
  }

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  /** Explicit user choice: saved and used from now on instead of the browser default. */
  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private browsing) — choice just won't persist.
    }
  }

  private systemMode(): ThemeMode {
    return this.media?.matches ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);
  }

  private readStored(): ThemeMode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }
}

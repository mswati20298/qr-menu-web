import { Injectable, signal } from '@angular/core';
import { rememberAuthAccent } from '../auth-background';
import { DEFAULT_THEME_COLOR, isThemeColor } from '../models/theme-color.model';

/** The restaurant's brand colour as seen by the admin panel. Settings previews a colour
 * with set(); the saved colour comes from the API via setSaved(). */
@Injectable({ providedIn: 'root' })
export class ThemeColorService {
  readonly color = signal<string>(DEFAULT_THEME_COLOR);

  /** Preview (not remembered). */
  set(key: string | null | undefined): void {
    this.color.set(isThemeColor(key) ? key : DEFAULT_THEME_COLOR);
  }

  /** The colour that is actually saved for this restaurant. Also remembered for the login screen. */
  setSaved(key: string | null | undefined): void {
    this.set(key);
    rememberAuthAccent(this.color());
  }
}

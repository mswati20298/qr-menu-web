import { Injectable, signal } from '@angular/core';
import { DEFAULT_THEME_COLOR, isThemeColor } from '../models/theme-color.model';

const STORAGE_KEY = 'qrmenu_superadmin_accent';

function readSaved(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemeColor(saved) ? saved : DEFAULT_THEME_COLOR;
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

/** The super admin panel's colour (same palettes as a restaurant's brand colour). Remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class SuperAdminAccentService {
  readonly color = signal<string>(readSaved());

  set(key: string): void {
    if (!isThemeColor(key)) {
      return;
    }
    this.color.set(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Private mode: the colour just isn't remembered.
    }
  }
}

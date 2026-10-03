const KEY = 'qrmenu_auth_bg';

/** Login / Register run before we know which restaurant is signing in, so we show
 * the background of the last restaurant that used this browser (if any). */
export function rememberAuthBackground(url: string | null): void {
  try {
    if (url) {
      localStorage.setItem(KEY, url);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Storage unavailable — login simply shows the default gradient.
  }
}

/** CSS value for background-image, or null for the default gradient. */
export function readAuthBackground(): string | null {
  try {
    const url = localStorage.getItem(KEY);
    return url ? `url("${url}")` : null;
  } catch {
    return null;
  }
}

const ACCENT_KEY = 'qrmenu_auth_accent';

/** Same idea for the brand colour: Login / Register use the last restaurant's colour. */
export function rememberAuthAccent(key: string): void {
  try {
    localStorage.setItem(ACCENT_KEY, key);
  } catch {
    // ignore
  }
}

export function readAuthAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_KEY);
  } catch {
    return null;
  }
}

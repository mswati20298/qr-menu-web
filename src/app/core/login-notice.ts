const KEY = 'qrmenu_login_notice';

/** A one-time message for the login page (e.g. "account suspended" after being signed out). */
export function setLoginNotice(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // ignore
  }
}

export function takeLoginNotice(): string | null {
  try {
    const message = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return message;
  } catch {
    return null;
  }
}

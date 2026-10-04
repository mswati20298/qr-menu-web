import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for actions that delete, cancel or cut something off. */
  danger?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'message'>> {
  id: number;
  message: string | null;
  resolve: (confirmed: boolean) => void;
}

/**
 * In-app replacement for the browser's alert() and confirm(): short toasts for results, and a toast-style
 * confirm for actions that need a yes. Rendered once for the whole app by <app-feedback-host>.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  readonly toasts = signal<Toast[]>([]);
  readonly confirmRequest = signal<ConfirmRequest | null>(null);

  private nextId = 1;

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message, 6000);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    this.toasts.set(this.toasts().filter((t) => t.id !== id));
  }

  /** Resolves true when the user confirms, false when they cancel, press Escape or another confirm replaces it. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    this.confirmRequest()?.resolve(false);

    return new Promise<boolean>((resolve) => {
      this.confirmRequest.set({
        id: this.nextId++,
        title: options.title,
        message: options.message ?? null,
        confirmLabel: options.confirmLabel ?? 'Yes, continue',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve
      });
    });
  }

  answer(confirmed: boolean): void {
    const request = this.confirmRequest();
    if (!request) {
      return;
    }
    this.confirmRequest.set(null);
    request.resolve(confirmed);
  }

  private show(kind: ToastKind, message: string, durationMs = 3500): void {
    const toast: Toast = { id: this.nextId++, kind, message };
    // Keep the stack short: the newest three are enough.
    this.toasts.set([...this.toasts(), toast].slice(-3));
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}

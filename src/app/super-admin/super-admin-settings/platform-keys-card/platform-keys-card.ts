import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyCheckResult, PlatformKeys, SecretKeyStatus, UpdatePlatformKeysRequest } from '../../../core/models/super-admin.model';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';

type SecretField = 'razorpayKeySecret' | 'razorpayWebhookSecret' | 'geminiApiKey';

/**
 * Razorpay and Gemini keys. A key saved here wins over the one in the server's .env file. Secrets are never sent
 * back to the browser: a saved one shows as "••••1234"; typing a new value replaces it.
 */
@Component({
  selector: 'app-platform-keys-card',
  imports: [DatePipe, FormsModule],
  templateUrl: './platform-keys-card.html',
  styleUrl: './platform-keys-card.scss'
})
export class PlatformKeysCard implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly feedback = inject(FeedbackService);

  readonly keys = signal<PlatformKeys | null>(null);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly testResult = signal<KeyCheckResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly visible = signal<Record<SecretField, boolean>>({ razorpayKeySecret: false, razorpayWebhookSecret: false, geminiApiKey: false });

  keyId = '';
  secrets: Record<SecretField, string> = { razorpayKeySecret: '', razorpayWebhookSecret: '', geminiApiKey: '' };

  readonly secretFields: { field: SecretField; label: string; hint: string }[] = [
    { field: 'razorpayKeySecret', label: 'Razorpay Key Secret', hint: 'Razorpay → Account & Settings → API Keys. Shown only once when you create the key.' },
    { field: 'razorpayWebhookSecret', label: 'Razorpay Webhook Secret', hint: 'The secret you typed when adding the webhook in Razorpay.' },
    { field: 'geminiApiKey', label: 'Gemini API key', hint: 'For “Scan menu photo”. From Google AI Studio → Get API key.' }
  ];

  ngOnInit(): void {
    this.service.keys().subscribe({
      next: (keys) => this.apply(keys),
      error: () => this.loadError.set(true)
    });
  }

  status(field: SecretField): SecretKeyStatus | null {
    return this.keys()?.[field] ?? null;
  }

  sourceLabel(source: 'panel' | 'server' | 'none'): string {
    return source === 'panel' ? 'Saved here' : source === 'server' ? 'From the server (.env)' : 'Not set';
  }

  toggleVisible(field: SecretField): void {
    this.visible.set({ ...this.visible(), [field]: !this.visible()[field] });
  }

  get hasChanges(): boolean {
    const current = this.keys();
    if (!current) {
      return false;
    }
    return this.keyId.trim() !== (current.razorpayKeyId ?? '') || Object.values(this.secrets).some((v) => v.trim() !== '');
  }

  save(): void {
    const current = this.keys();
    if (!current || !this.hasChanges) {
      return;
    }
    const request: UpdatePlatformKeysRequest = {};
    if (this.keyId.trim() !== (current.razorpayKeyId ?? '')) {
      request.razorpayKeyId = this.keyId.trim();
    }
    for (const { field } of this.secretFields) {
      if (this.secrets[field].trim()) {
        request[field] = this.secrets[field].trim();
      }
    }
    this.send(request, 'Keys saved. They are in use straight away.');
  }

  async remove(field: SecretField | 'razorpayKeyId', label: string): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Remove the ${label} saved here?`,
      message: 'The value from the server (.env) is used again, if there is one.',
      confirmLabel: 'Remove',
      danger: true
    });
    if (confirmed) {
      this.send({ [field]: '' }, `${label} removed.`);
    }
  }

  test(): void {
    this.testing.set(true);
    this.testResult.set(null);
    const keyId = this.keyId.trim() !== (this.keys()?.razorpayKeyId ?? '') ? this.keyId.trim() : null;
    this.service.testRazorpay(keyId, this.secrets.razorpayKeySecret.trim() || null).subscribe({
      next: (result) => {
        this.testing.set(false);
        this.testResult.set(result);
      },
      error: () => {
        this.testing.set(false);
        this.testResult.set({ ok: false, message: 'Could not run the check. Please try again.' });
      }
    });
  }

  async copyWebhookUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.feedback.success('Webhook URL copied.');
    } catch {
      this.feedback.info(url);
    }
  }

  /** "Never saved yet" comes back as year 1 from the API. */
  hasBeenSaved(keys: PlatformKeys): boolean {
    return new Date(keys.updatedAt).getFullYear() > 2000;
  }

  private send(request: UpdatePlatformKeysRequest, successMessage: string): void {
    this.saving.set(true);
    this.error.set(null);
    this.service.updateKeys(request).subscribe({
      next: (keys) => {
        this.saving.set(false);
        this.apply(keys);
        this.feedback.success(successMessage);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(firstError(err) ?? 'Could not save. Please try again.');
      }
    });
  }

  private apply(keys: PlatformKeys): void {
    this.keys.set(keys);
    this.keyId = keys.razorpayKeyId ?? '';
    this.secrets = { razorpayKeySecret: '', razorpayWebhookSecret: '', geminiApiKey: '' };
    this.testResult.set(null);
  }
}

/** Validation errors arrive as a list or as { field: [messages] }. */
function firstError(err: unknown): string | null {
  const body = (err as { error?: { errors?: unknown; message?: string } })?.error;
  const errors = body?.errors;
  if (Array.isArray(errors) && errors.length) {
    return String(errors[0]);
  }
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors as Record<string, string[]>)[0];
    if (first?.length) {
      return first[0];
    }
  }
  return body?.message ?? null;
}

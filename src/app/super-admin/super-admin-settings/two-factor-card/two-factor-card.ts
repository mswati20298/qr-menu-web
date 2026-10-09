import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TwoFactorSetup, TwoFactorStatus } from '../../../core/models/super-admin.model';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { errorMessage } from '../../../core/utils/http-error';

type Step = 'idle' | 'scan' | 'codes' | 'disable' | 'regen';

/**
 * Two-step login for the super admin: after the password, a 6-digit code from an authenticator app
 * (Google Authenticator, Microsoft Authenticator, Authy...). Recovery codes cover a lost phone.
 */
@Component({
  selector: 'app-two-factor-card',
  imports: [FormsModule],
  templateUrl: './two-factor-card.html',
  styleUrl: './two-factor-card.scss'
})
export class TwoFactorCard implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly toast = inject(FeedbackService);

  readonly status = signal<TwoFactorStatus | null>(null);
  readonly step = signal<Step>('idle');
  readonly setup = signal<TwoFactorSetup | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  code = '';
  password = '';

  ngOnInit(): void {
    this.refresh();
  }

  start(): void {
    this.run(this.service.twoFactorSetup(), (setup) => {
      this.setup.set(setup);
      this.step.set('scan');
    });
  }

  enable(): void {
    this.run(this.service.twoFactorEnable(this.code.trim()), (res) => {
      this.recoveryCodes.set(res.recoveryCodes);
      this.step.set('codes');
      this.setup.set(null);
      this.refresh();
      this.toast.success('Two-step login is on.');
    });
  }

  newCodes(): void {
    this.run(this.service.twoFactorNewRecoveryCodes(this.code.trim()), (res) => {
      this.recoveryCodes.set(res.recoveryCodes);
      this.step.set('codes');
      this.refresh();
    });
  }

  disable(): void {
    this.run(this.service.twoFactorDisable(this.password, this.code.trim()), () => {
      this.step.set('idle');
      this.refresh();
      this.toast.success('Two-step login is off.');
    });
  }

  open(step: Step): void {
    this.code = '';
    this.password = '';
    this.error.set(null);
    this.step.set(step);
  }

  done(): void {
    this.recoveryCodes.set([]);
    this.open('idle');
  }

  async copyCodes(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
      this.toast.success('Recovery codes copied.');
    } catch {
      this.toast.info('Select the codes and copy them by hand.');
    }
  }

  downloadCodes(): void {
    const text = `QRenvo super admin recovery codes\nEach code works once. Keep them somewhere safe.\n\n${this.recoveryCodes().join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrenvo-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  private refresh(): void {
    this.service.twoFactorStatus().subscribe({ next: (s) => this.status.set(s), error: () => undefined });
  }

  private run<T>(call: import('rxjs').Observable<T>, onDone: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: (value) => {
        this.busy.set(false);
        this.code = '';
        this.password = '';
        onDone(value);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(errorMessage(err, 'That did not work. Please try again.'));
      }
    });
  }
}

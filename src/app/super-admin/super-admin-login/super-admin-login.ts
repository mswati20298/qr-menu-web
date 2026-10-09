import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SuperAdminAuthService } from '../../core/services/super-admin-auth.service';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';
import { errorMessage } from '../../core/utils/http-error';

@Component({
  selector: 'app-super-admin-login',
  imports: [ReactiveFormsModule, FormsModule, ThemeToggle],
  templateUrl: './super-admin-login.html',
  // Same look as the restaurant login / register screens.
  styleUrl: '../../admin/login/auth-page.scss'
})
export class SuperAdminLogin {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(SuperAdminAuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** Set after the password step when two-step login is on. */
  readonly challenge = signal<string | null>(null);
  readonly useRecovery = signal(false);
  code = '';

  readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required])
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        if (res.requiresTwoFactor && res.challengeToken) {
          this.submitting.set(false);
          this.challenge.set(res.challengeToken);
          return;
        }
        this.router.navigate(['/superadmin']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(errorMessage(err, 'Login failed. Please check your credentials.'));
      }
    });
  }

  verifyCode(): void {
    const challenge = this.challenge();
    const code = this.code.trim();
    if (!challenge || !code) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.verifyTwoFactor(challenge, code).subscribe({
      next: () => this.router.navigate(['/superadmin']),
      error: (err) => {
        this.submitting.set(false);
        this.code = '';
        // An expired challenge means starting again from the password.
        if (err?.status === 401 && /expired/i.test(errorMessage(err, ''))) {
          this.challenge.set(null);
        }
        this.errorMessage.set(errorMessage(err, 'That code did not work. Please try again.'));
      }
    });
  }

  /** The 6 digits from the app are checked as soon as they are all typed (or pasted). */
  onCodeChange(value: string): void {
    if (!this.useRecovery() && /^\d{6}$/.test(value.trim()) && !this.submitting()) {
      this.verifyCode();
    }
  }

  backToPassword(): void {
    this.challenge.set(null);
    this.code = '';
    this.errorMessage.set(null);
  }
}

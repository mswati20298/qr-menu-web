import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SuperAdminAuthService } from '../../../core/services/super-admin-auth.service';
import { errorMessage } from '../../../core/utils/http-error';

/** The super admin changes their own password. Other devices are signed out. */
@Component({
  selector: 'app-password-card',
  imports: [ReactiveFormsModule],
  templateUrl: './password-card.html',
  styleUrl: '../two-factor-card/two-factor-card.scss'
})
export class PasswordCard {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(SuperAdminAuthService);
  private readonly toast = inject(FeedbackService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(10)]],
    confirm: ['', Validators.required]
  });

  save(): void {
    const { current, next, confirm } = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(next.length < 10 ? 'Use at least 10 characters for the new password.' : 'Fill in all three fields.');
      return;
    }
    if (next !== confirm) {
      this.error.set('The two new passwords do not match.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        this.toast.success('Password changed. Other devices are signed out.');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err, 'Could not change the password.'));
      }
    });
  }
}

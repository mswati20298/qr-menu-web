import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { readAuthAccent, readAuthBackground } from '../../core/auth-background';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggle],
  templateUrl: './register.html',
  styleUrl: '../login/auth-page.scss'
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly backgroundImage = readAuthBackground();
  readonly accent = readAuthAccent() ?? 'masala';
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    restaurantName: this.fb.control('', [Validators.required]),
    ownerName: this.fb.control('', [Validators.required]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(6)]),
    whatsAppNumber: this.fb.control('', [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)])
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();

    this.authService
      .register({
        restaurantName: value.restaurantName!,
        ownerName: value.ownerName!,
        email: value.email!,
        password: value.password!,
        whatsAppNumber: value.whatsAppNumber!
      })
      .subscribe({
        next: () => this.router.navigate(['/admin/dashboard']),
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Registration failed. Please try again.');
        }
      });
  }
}

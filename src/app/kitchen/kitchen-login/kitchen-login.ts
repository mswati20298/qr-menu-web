import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeLoginNotice } from '../../core/login-notice';
import { KitchenAuthService } from '../../core/services/kitchen-auth.service';
import { errorMessage } from '../../core/utils/http-error';

/** Sign-in for a shared kitchen tablet: restaurant link name + the kitchen PIN the owner set. */
@Component({
  selector: 'app-kitchen-login',
  imports: [ReactiveFormsModule],
  templateUrl: './kitchen-login.html',
  styleUrl: './kitchen-login.scss'
})
export class KitchenLogin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(KitchenAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    slug: ['', [Validators.required, Validators.maxLength(100)]],
    pin: ['', [Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]]
  });

  ngOnInit(): void {
    this.error.set(takeLoginNotice());
    const slug = this.route.snapshot.queryParamMap.get('r') ?? this.auth.lastSlug();
    this.form.patchValue({ slug });
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/kitchen']);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { slug, pin } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(slug.trim().toLowerCase(), pin).subscribe({
      next: () => this.router.navigate(['/kitchen']),
      error: (err) => {
        this.loading.set(false);
        this.form.controls.pin.reset('');
        this.error.set(errorMessage(err, 'Could not sign in. Please try again.'));
      }
    });
  }
}

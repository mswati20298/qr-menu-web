import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformSettings } from '../../core/models/super-admin.model';
import { THEME_COLORS } from '../../core/models/theme-color.model';
import { SuperAdminAccentService } from '../../core/services/super-admin-accent.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { DemoResetCard } from './demo-reset-card/demo-reset-card';
import { PlatformKeysCard } from './platform-keys-card/platform-keys-card';
import { TwoFactorCard } from './two-factor-card/two-factor-card';

/** Platform-wide settings: free trial length, payment and AI keys, and (on the demo) the demo reset. */
@Component({
  selector: 'app-super-admin-settings',
  imports: [DatePipe, ReactiveFormsModule, PlatformKeysCard, DemoResetCard, TwoFactorCard],
  templateUrl: './super-admin-settings.html',
  styleUrl: './super-admin-settings.scss'
})
export class SuperAdminSettings implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly fb = inject(FormBuilder);
  readonly accent = inject(SuperAdminAccentService);
  readonly themeColors = THEME_COLORS;

  readonly settings = signal<PlatformSettings | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    trialDays: [3, [Validators.required, Validators.min(0), Validators.max(90), Validators.pattern(/^[0-9]+$/)]]
  });

  ngOnInit(): void {
    this.service.settings().subscribe({
      next: (settings) => this.apply(settings),
      error: () => this.error.set('Could not load the settings.')
    });
  }

  setDays(days: number): void {
    this.form.controls.trialDays.setValue(days);
    this.form.markAsDirty();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.service.updateSettings(Number(this.form.controls.trialDays.value)).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.saved.set(true);
        this.apply(settings);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not save. Please try again.');
      }
    });
  }

  /** "Never saved yet" comes back as year 1 from the API (configured default in use). */
  hasBeenSaved(settings: PlatformSettings): boolean {
    return new Date(settings.updatedAt).getFullYear() > 2000;
  }

  private apply(settings: PlatformSettings): void {
    this.settings.set(settings);
    this.form.reset({ trialDays: settings.trialDays });
  }
}

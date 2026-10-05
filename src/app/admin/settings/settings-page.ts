import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { UploadService } from '../../core/services/upload.service';
import { BackgroundManager } from './background-manager/background-manager';
import { RestaurantService } from '../../core/services/restaurant.service';
import { DEFAULT_THEME_COLOR, THEME_COLORS } from '../../core/models/theme-color.model';
import { ThemeColorService } from '../../core/services/theme-color.service';

/** UPI needs a name to show customers once a UPI ID is entered. */
function payeeRequired(group: AbstractControl): ValidationErrors | null {
  const upiId = (group.get('upiId')?.value ?? '').trim();
  const payee = (group.get('upiPayeeName')?.value ?? '').trim();
  return upiId && !payee ? { payeeRequired: true } : null;
}

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, BackgroundManager],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss'
})
export class SettingsPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly restaurantService = inject(RestaurantService);
  private readonly uploadService = inject(UploadService);
  private readonly themeColorService = inject(ThemeColorService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly logoUploading = signal(false);
  readonly logoUrl = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  readonly kitchenLoginEnabled = signal(false);
  readonly kitchenPin = signal('');
  readonly kitchenSaving = signal(false);
  readonly kitchenMessage = signal<string | null>(null);
  readonly kitchenError = signal<string | null>(null);

  readonly themeColors = THEME_COLORS;
  readonly themeColor = signal<string>(DEFAULT_THEME_COLOR);
  private savedThemeColor = DEFAULT_THEME_COLOR;

  readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required]),
    tagline: this.fb.control(''),
    address: this.fb.control(''),
    phone: this.fb.control(''),
    whatsAppNumber: this.fb.control('', [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)]),
    openTime: this.fb.control('11:00', [Validators.required]),
    closeTime: this.fb.control('23:00', [Validators.required]),
    isGstEnabled: this.fb.control(true),
    gstPercentage: this.fb.control(5, [Validators.required, Validators.min(0), Validators.max(100)]),
    isServiceChargeEnabled: this.fb.control(false),
    serviceChargePercentage: this.fb.control(10, [Validators.required, Validators.min(0), Validators.max(100)]),
    showWelcomeMessage: this.fb.control(false),
    welcomeMessage: this.fb.control(''),
    gstNumber: this.fb.control('', [Validators.pattern(/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/)]),
    invoicePrefix: this.fb.control('INV', [Validators.pattern(/^[A-Za-z0-9]{1,10}$/)]),
    upiId: this.fb.control('', [Validators.pattern(/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/)]),
    upiPayeeName: this.fb.control('', [Validators.maxLength(100)])
  }, { validators: payeeRequired });

  /** Link to give the kitchen tablet; the restaurant is filled in. */
  readonly kitchenLoginUrl = computed(() => {
    const slug = this.authService.currentSession()?.restaurantSlug;
    return this.kitchenLoginEnabled() && slug ? `${window.location.origin}/kitchen/login?r=${slug}` : null;
  });

  ngOnInit(): void {
    this.restaurantService.get().subscribe((restaurant) => {
      this.form.patchValue({
        name: restaurant.name,
        tagline: restaurant.tagline ?? '',
        address: restaurant.address ?? '',
        phone: restaurant.phone ?? '',
        whatsAppNumber: restaurant.whatsAppNumber,
        openTime: restaurant.openTime,
        closeTime: restaurant.closeTime,
        isGstEnabled: restaurant.isGstEnabled,
        gstPercentage: restaurant.gstPercentage,
        isServiceChargeEnabled: restaurant.isServiceChargeEnabled,
        serviceChargePercentage: restaurant.serviceChargePercentage,
        showWelcomeMessage: restaurant.showWelcomeMessage,
        welcomeMessage: restaurant.welcomeMessage ?? '',
        gstNumber: restaurant.gstNumber ?? '',
        invoicePrefix: restaurant.invoicePrefix,
        upiId: restaurant.upiId ?? '',
        upiPayeeName: restaurant.upiPayeeName ?? ''
      });
      this.kitchenLoginEnabled.set(restaurant.kitchenLoginEnabled);
      this.logoUrl.set(restaurant.logoUrl);
      this.savedThemeColor = restaurant.themeColor ?? DEFAULT_THEME_COLOR;
      this.themeColor.set(this.savedThemeColor);
    });
  }

  ngOnDestroy(): void {
    // Leaving without saving: drop the colour preview and go back to the saved one.
    this.themeColorService.set(this.savedThemeColor);
  }

  /** Picks a colour and previews it straight away on this admin panel; Save keeps it. */
  selectColor(key: string): void {
    this.themeColor.set(key);
    this.themeColorService.set(key);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.logoUploading.set(true);
    this.uploadService.uploadImage(file, 'logo').subscribe({
      next: (result) => {
        this.logoUrl.set(result.url);
        this.logoUploading.set(false);
      },
      error: () => this.logoUploading.set(false)
    });
  }

  resolveLogoUrl(): string | null {
    return this.uploadService.resolveUrl(this.logoUrl());
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);
    const value = this.form.getRawValue();

    this.restaurantService
      .update({
        name: value.name!,
        tagline: value.tagline || null,
        address: value.address || null,
        phone: value.phone || null,
        whatsAppNumber: value.whatsAppNumber!,
        openTime: value.openTime!,
        closeTime: value.closeTime!,
        logoUrl: this.logoUrl(),
        coverImageUrl: null, // managed by the background gallery (ignored by the API)
        isGstEnabled: value.isGstEnabled!,
        gstPercentage: value.gstPercentage!,
        isServiceChargeEnabled: value.isServiceChargeEnabled!,
        serviceChargePercentage: value.serviceChargePercentage!,
        showWelcomeMessage: value.showWelcomeMessage!,
        welcomeMessage: value.welcomeMessage || null,
        themeColor: this.themeColor(),
        gstNumber: value.gstNumber?.trim() || null,
        invoicePrefix: value.invoicePrefix?.trim() || null,
        upiId: value.upiId?.trim() || null,
        upiPayeeName: value.upiPayeeName?.trim() || null
      })
      .subscribe({
        next: () => {
          this.savedThemeColor = this.themeColor();
          this.themeColorService.setSaved(this.savedThemeColor);
          this.saving.set(false);
          this.saved.set(true);
          setTimeout(() => this.saved.set(false), 2500);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not save. Please try again.');
        }
      });
  }

  saveKitchenPin(): void {
    const pin = this.kitchenPin().trim();
    if (!/^[0-9]{4,8}$/.test(pin)) {
      this.kitchenError.set('The PIN must be 4 to 8 digits.');
      return;
    }
    this.updateKitchenPin(pin, this.kitchenLoginEnabled() ? 'PIN changed. Kitchen screens need to sign in again.' : 'Kitchen login is on.');
  }

  async disableKitchenLogin(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: 'Turn off the kitchen login?',
      message: 'Every kitchen screen is signed out. You can still open the kitchen screen from Orders.',
      confirmLabel: 'Turn off',
      danger: true
    });
    if (confirmed) {
      this.updateKitchenPin(null, 'Kitchen login is off.');
    }
  }

  private updateKitchenPin(pin: string | null, message: string): void {
    this.kitchenSaving.set(true);
    this.kitchenMessage.set(null);
    this.kitchenError.set(null);
    this.restaurantService.setKitchenPin(pin).subscribe({
      next: (restaurant) => {
        this.kitchenSaving.set(false);
        this.kitchenPin.set('');
        this.kitchenLoginEnabled.set(restaurant.kitchenLoginEnabled);
        this.kitchenMessage.set(message);
      },
      error: (err) => {
        this.kitchenSaving.set(false);
        this.kitchenError.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not save the PIN.');
      }
    });
  }
}

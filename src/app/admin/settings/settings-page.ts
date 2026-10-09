import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { UploadService } from '../../core/services/upload.service';
import { BackgroundManager } from './background-manager/background-manager';
import { RestaurantService } from '../../core/services/restaurant.service';
import { DEFAULT_THEME_COLOR, THEME_COLORS } from '../../core/models/theme-color.model';
import { ThemeColorService } from '../../core/services/theme-color.service';
import { errorMessage } from '../../core/utils/http-error';

/** UPI needs a name to show customers once a UPI ID is entered. */
type SettingsTab = 'details' | 'billing' | 'look' | 'kitchen' | 'address' | 'password';

/** Which tab each saved-form field lives on, so a failed save can open the tab with the problem. */
const FIELD_TAB: Record<string, SettingsTab> = {
  name: 'details', tagline: 'details', address: 'details', phone: 'details', whatsAppNumber: 'details',
  openTime: 'details', closeTime: 'details',
  isGstEnabled: 'billing', gstPercentage: 'billing', isServiceChargeEnabled: 'billing',
  serviceChargePercentage: 'billing', gstNumber: 'billing', invoicePrefix: 'billing', upiId: 'billing',
  upiPayeeName: 'billing',
  showWelcomeMessage: 'look', welcomeMessage: 'look',
  requireTableQr: 'details', qrSessionHours: 'details', allowLinkTakeaway: 'details'
};

function payeeRequired(group: AbstractControl): ValidationErrors | null {
  const upiId = (group.get('upiId')?.value ?? '').trim();
  const payee = (group.get('upiPayeeName')?.value ?? '').trim();
  return upiId && !payee ? { payeeRequired: true } : null;
}

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, FormsModule, BackgroundManager],
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

  readonly tabs: { key: SettingsTab; label: string }[] = [
    { key: 'details', label: 'Restaurant' },
    { key: 'billing', label: 'Billing & UPI' },
    { key: 'look', label: 'Menu look' },
    { key: 'kitchen', label: 'Kitchen' },
    { key: 'address', label: 'Web address' },
    { key: 'password', label: 'Password' }
  ];
  readonly tab = signal<SettingsTab>(this.initialTab());
  /** The first three tabs share one form and one Save button. */
  readonly isFormTab = computed(() => ['details', 'billing', 'look'].includes(this.tab()));
  readonly nextTab = computed(() => {
    const i = this.tabs.findIndex((x) => x.key === this.tab());
    const next = this.tabs[i + 1];
    return next && ['details', 'billing', 'look'].includes(next.key) ? next : null;
  });

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

  readonly menuUrl = signal('');
  readonly rootDomain = signal<string | null>(null);
  readonly subdomain = signal('');
  readonly subdomainSaving = signal(false);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordSaving = signal(false);

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
    upiPayeeName: this.fb.control('', [Validators.maxLength(100)]),
    requireTableQr: this.fb.control(false),
    qrSessionHours: this.fb.control(3),
    allowLinkTakeaway: this.fb.control(true)
  }, { validators: payeeRequired });

  readonly sessionHourOptions = [1, 2, 3, 4, 6, 8, 12];

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
        upiPayeeName: restaurant.upiPayeeName ?? '',
        requireTableQr: restaurant.requireTableQr,
        qrSessionHours: restaurant.qrSessionHours,
        allowLinkTakeaway: restaurant.allowLinkTakeaway
      });
      this.kitchenLoginEnabled.set(restaurant.kitchenLoginEnabled);
      this.applyAddress(restaurant);
      this.logoUrl.set(restaurant.logoUrl);
      this.savedThemeColor = restaurant.themeColor ?? DEFAULT_THEME_COLOR;
      this.themeColor.set(this.savedThemeColor);
    });
  }

  ngOnDestroy(): void {
    // Leaving without saving: drop the colour preview and go back to the saved one.
    this.themeColorService.set(this.savedThemeColor);
  }

  selectTab(key: SettingsTab): void {
    this.tab.set(key);
    this.saved.set(false);
    // Remembered in the address (#billing) so a reload or a shared link opens the same section.
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${key}`);
  }

  private initialTab(): SettingsTab {
    const hash = location.hash.replace('#', '');
    return (['details', 'billing', 'look', 'kitchen', 'address', 'password'] as string[]).includes(hash)
      ? (hash as SettingsTab)
      : 'details';
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
      // The problem may be on another tab: open the first tab that has one.
      const bad = Object.keys(this.form.controls).find((k) => this.form.get(k)?.invalid);
      const target = bad ? FIELD_TAB[bad] : this.form.hasError('payeeRequired') ? 'billing' : null;
      if (target) {
        this.selectTab(target);
      }
      this.saveError.set('Please fix the highlighted field before saving.');
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
        upiPayeeName: value.upiPayeeName?.trim() || null,
        requireTableQr: !!value.requireTableQr,
        qrSessionHours: Number(value.qrSessionHours) || 3,
        allowLinkTakeaway: !!value.allowLinkTakeaway
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
          this.saveError.set(errorMessage(err, 'Could not save. Please try again.'));
        }
      });
  }

  saveSubdomain(): void {
    const name = this.subdomain().trim();
    if (name && !/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(name)) {
      this.feedback.error('Use 3–30 lower-case letters, numbers or hyphens (not at the start or end).');
      return;
    }
    this.subdomainSaving.set(true);
    this.restaurantService.setSubdomain(name || null).subscribe({
      next: (restaurant) => {
        this.subdomainSaving.set(false);
        this.applyAddress(restaurant);
        this.feedback.success(name ? `Your menu is now at ${restaurant.menuUrl}` : 'Own address removed.');
      },
      error: (err) => {
        this.subdomainSaving.set(false);
        this.feedback.error(errorMessage(err, 'Could not save the address.'));
      }
    });
  }

  changePassword(): void {
    const current = this.currentPassword();
    const next = this.newPassword();
    if (!current || next.length < 8) {
      this.feedback.error('Enter your current password and a new one of at least 8 characters.');
      return;
    }
    if (next !== this.confirmPassword()) {
      this.feedback.error('The two new passwords do not match.');
      return;
    }
    this.passwordSaving.set(true);
    this.authService.changePassword(current, next).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.feedback.success('Password changed. Other devices have been signed out.');
      },
      error: (err) => {
        this.passwordSaving.set(false);
        this.feedback.error(errorMessage(err, 'Could not change the password.'));
      }
    });
  }

  private applyAddress(restaurant: { menuUrl: string; subdomain: string | null; subdomainsEnabled: boolean; rootDomain: string | null }): void {
    this.menuUrl.set(restaurant.menuUrl);
    this.subdomain.set(restaurant.subdomain ?? '');
    this.rootDomain.set(restaurant.subdomainsEnabled ? restaurant.rootDomain : null);
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
        this.kitchenError.set(errorMessage(err, 'Could not save the PIN.'));
      }
    });
  }
}

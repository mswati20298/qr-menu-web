import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { rememberAuthBackground } from '../../core/auth-background';
import { pickBackgroundUrl } from '../../core/background-picker';
import { BackgroundService } from '../../core/services/background.service';
import { ThemeColorService } from '../../core/services/theme-color.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { UploadService } from '../../core/services/upload.service';
import { NotificationBell } from '../components/notification-bell/notification-bell';
import { ToastContainer } from '../components/toast-container/toast-container';

const OPEN_STATUS_REFRESH_MS = 60000;

function computeIsOpenNow(openTime: string, closeTime: string): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  return close > open ? nowMinutes >= open && nowMinutes <= close : nowMinutes >= open || nowMinutes <= close;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationBell, ToastContainer],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayout implements OnInit, OnDestroy {
  readonly theme = inject(ThemeService);
  readonly authService = inject(AuthService);
  readonly notifications = inject(OrderNotificationService);
  private readonly restaurantService = inject(RestaurantService);
  private readonly uploadService = inject(UploadService);
  private readonly backgrounds = inject(BackgroundService);
  readonly themeColor = inject(ThemeColorService);

  readonly logoUrl = signal<string | null>(null);
  private readonly now = signal(new Date());

  /** Background photo for the admin panel: fixed, or the one for the current time of day. */
  private readonly backgroundUrl = computed(() => {
    const settings = this.backgrounds.settings();
    const picked = settings ? pickBackgroundUrl(settings.mode, settings.items, this.now()) : null;
    return this.uploadService.resolveUrl(picked);
  });

  readonly backgroundImage = computed(() => {
    const url = this.backgroundUrl();
    return url ? `url("${url}")` : null;
  });

  // Remember it so the Login / Register screens can show the same photo next time.
  private readonly rememberBackground = effect(() => {
    if (this.backgrounds.settings() !== null) {
      rememberAuthBackground(this.backgroundUrl());
    }
  });
  readonly plan = this.restaurantService.currentPlan;

  /** Warning shown above every admin page when the plan is ending, in grace, or has stopped ordering. */
  readonly planNotice = computed<{ text: string; danger: boolean } | null>(() => {
    const plan = this.plan();
    if (!plan) {
      return null;
    }
    const days = (n: number | null) => `${n} day${n === 1 ? '' : 's'}`;
    const isTrial = plan.plan === 'Trial';
    switch (plan.status) {
      case 'Expired':
        return {
          text: isTrial
            ? 'Your free trial has ended — customers cannot place orders. Choose a plan to continue.'
            : 'Your plan has expired — customers cannot place orders.',
          danger: true
        };
      case 'Cancelled':
        return { text: 'Your plan was cancelled — customers cannot place orders.', danger: true };
      case 'Grace':
        return { text: `Your plan has ended. Ordering stops in ${days(plan.daysLeft)} unless it is renewed.`, danger: false };
      default:
        if (isTrial) {
          return { text: `Free trial: ${days(plan.daysLeft)} left. Choose a plan to keep taking orders.`, danger: false };
        }
        return plan.daysLeft !== null && plan.daysLeft <= 7
          ? { text: `Your ${plan.planName} plan ends in ${days(plan.daysLeft)}.`, danger: false }
          : null;
    }
  });

  readonly isOpenNow = signal<boolean | null>(null);
  readonly profileMenuOpen = signal(false);
  private openStatusHandle: ReturnType<typeof setInterval> | null = null;
  private openTime = '';
  private closeTime = '';

  readonly initials = computed(() => {
    const name = this.authService.currentSession()?.restaurantName ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || 'R';
  });

  /** Set from the restaurant (own address like saket.qrenvo.com) once loaded; until then the /m/{slug} link. */
  private readonly ownMenuUrl = signal<string | null>(null);
  readonly liveMenuUrl = computed(() => {
    const slug = this.authService.currentSession()?.restaurantSlug;
    return this.ownMenuUrl() ?? (slug ? `${window.location.origin}/m/${slug}` : null);
  });

  ngOnInit(): void {
    this.notifications.start();

    this.restaurantService.get().subscribe((restaurant) => {
      this.logoUrl.set(this.uploadService.resolveUrl(restaurant.logoUrl));
      this.themeColor.setSaved(restaurant.themeColor);
      this.openTime = restaurant.openTime;
      this.closeTime = restaurant.closeTime;
      this.ownMenuUrl.set(restaurant.subdomainsEnabled && restaurant.subdomain ? restaurant.menuUrl : null);
      this.isOpenNow.set(computeIsOpenNow(this.openTime, this.closeTime));
    });

    this.backgrounds.load().subscribe({ error: () => undefined });

    this.restaurantService.getPlan().subscribe({ error: () => undefined });

    this.openStatusHandle = setInterval(() => {
      this.now.set(new Date());
      if (this.openTime && this.closeTime) {
        this.isOpenNow.set(computeIsOpenNow(this.openTime, this.closeTime));
      }
    }, OPEN_STATUS_REFRESH_MS);
  }

  ngOnDestroy(): void {
    this.notifications.stop();
    if (this.openStatusHandle) {
      clearInterval(this.openStatusHandle);
    }
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.set(!this.profileMenuOpen());
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}

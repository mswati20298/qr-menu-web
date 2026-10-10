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
import { FeedbackService } from '../../core/services/feedback.service';
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

/** From this many days before ordering stops, the plan banner turns urgent. */
const URGENT_DAYS = 3;

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
  private readonly toast = inject(FeedbackService);

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

  /**
   * Warning shown above every admin page when the plan is ending, in grace, or has stopped ordering.
   * urgent (3 days or less before ordering stops, or stopped): stronger look, stays on top while scrolling,
   * and a reminder pops up once a day.
   */
  readonly planNotice = computed<{ text: string; danger: boolean; urgent: boolean; action: string } | null>(() => {
    const notice = this.basePlanNotice();
    const plan = this.plan();
    if (!notice || !plan) {
      return null;
    }
    const stopsSoon = plan.daysLeft !== null && plan.daysLeft <= URGENT_DAYS;
    const urgent = notice.danger || stopsSoon;
    const action = plan.status === 'Expired' || plan.status === 'Cancelled' || plan.plan === 'Trial' ? 'Choose a plan' : 'Renew now';
    return { ...notice, danger: notice.danger, urgent, action };
  });

  private readonly basePlanNotice = computed<{ text: string; danger: boolean } | null>(() => {
    const plan = this.plan();
    if (!plan) {
      return null;
    }
    // "today" / "tomorrow" read better than "0 days" / "1 day" when time is short.
    const days = (n: number | null) => (n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`);
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
        return {
          text: plan.daysLeft === 0
            ? 'Your plan has ended. Ordering stops today unless it is renewed.'
            : `Your plan has ended. Ordering stops in ${days(plan.daysLeft)} unless it is renewed.`,
          danger: false
        };
      default:
        if (isTrial) {
          return {
            text: plan.daysLeft === 0
              ? 'Your free trial ends today. Choose a plan to keep taking orders.'
              : `Free trial: ${days(plan.daysLeft)} left. Choose a plan to keep taking orders.`,
            danger: false
          };
        }
        if (plan.daysLeft === null || plan.daysLeft > 7) {
          return null;
        }
        const on = plan.expiresAt ? ` (${new Date(plan.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})` : '';
        return {
          text: plan.daysLeft === 0
            ? `Your ${plan.planName} plan ends today${on}. Renew so customers can keep ordering.`
            : `Your ${plan.planName} plan ends in ${days(plan.daysLeft)}${on}. Renew so customers can keep ordering.`,
          danger: false
        };
    }
  });

  /** Once a day, a pop-up reminder when the plan is about to stop ordering (or has). */
  private readonly remindOncePerDay = effect(() => {
    const notice = this.planNotice();
    if (!notice?.urgent) {
      return;
    }
    const key = `qrmenu_plan_reminder_${this.authService.currentSession()?.restaurantId ?? ''}`;
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem(key) === today) {
        return;
      }
      localStorage.setItem(key, today);
    } catch {
      // No storage (private browsing): the banner is still there.
    }
    this.toast.info(notice.text);
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

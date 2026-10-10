import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { pickBackgroundUrl } from '../../core/background-picker';
import { readMenuAccent, rememberMenuAccent } from '../../core/auth-background';
import { DEFAULT_THEME_COLOR, isThemeColor } from '../../core/models/theme-color.model';
import { CartService } from '../../core/services/cart.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { UploadService } from '../../core/services/upload.service';
import { HelpSheet } from '../components/help-sheet/help-sheet';

@Component({
  selector: 'app-customer-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HelpSheet],
  templateUrl: './customer-shell.html',
  styleUrl: './customer-shell.scss'
})
export class CustomerShell implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly session = inject(PublicSessionService);
  readonly cart = inject(CartService);

  private readonly uploadService = inject(UploadService);

  readonly helpOpen = signal(false);

  // Once the menu is known, repair any sized dish sitting in the cart without a size.
  private readonly repairCart = effect(() => {
    const menu = this.session.menu();
    if (menu) {
      untracked(() => this.cart.fixMissingSizes(menu.categories.flatMap((c) => c.items)));
    }
  });

  /** Colour this restaurant's menu used last time on this phone: shown while the menu is still loading. */
  private readonly cachedAccent = (() => {
    const key = readMenuAccent(this.route.snapshot.paramMap.get('slug') ?? '');
    return isThemeColor(key) ? key : null;
  })();

  /** Brand colour picked by the restaurant (drives the [data-accent] palette). */
  readonly accent = computed(
    () => this.session.menu()?.restaurant?.themeColor ?? this.cachedAccent ?? DEFAULT_THEME_COLOR
  );

  private readonly rememberAccent = effect(() => {
    const restaurant = this.session.menu()?.restaurant;
    if (restaurant?.themeColor) {
      rememberMenuAccent(restaurant.slug, restaurant.themeColor);
    }
  });

  /** Item detail and order status are full-screen pages without the bottom tab bar. */
  readonly hideNav = signal(false);
  private navSubscription: Subscription | null = null;

  /** Ticks every minute so a time-of-day background switches while the menu stays open. */
  private readonly now = signal(new Date());
  private clockHandle: ReturnType<typeof setInterval> | null = null;

  /** Per-restaurant background: fixed image, or the one for the current time of day. */
  readonly backgroundImage = computed(() => {
    const restaurant = this.session.menu()?.restaurant;
    if (!restaurant) {
      return null;
    }
    const picked = restaurant.backgrounds?.length
      ? pickBackgroundUrl(restaurant.backgroundMode, restaurant.backgrounds, this.now())
      : restaurant.coverImageUrl; // older data / API without gallery
    const url = this.uploadService.resolveUrl(picked ?? null);
    return url ? `url("${url}")` : null;
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    // Printed QR cards use "?t=" (server PDF) or "?table=" (QR page PDF); accept both.
    const query = this.route.snapshot.queryParamMap;
    const table = query.get('t') ?? query.get('table');
    // k = the table's secret code, printed in its QR; it starts a time-limited table session.
    this.session.init(slug, table, query.get('k'));
    this.clockHandle = setInterval(() => this.now.set(new Date()), 60000);

    this.updateNavVisibility();
    this.navSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateNavVisibility());
  }

  private updateNavVisibility(): void {
    let current = this.router.routerState.snapshot.root;
    while (current.firstChild) {
      current = current.firstChild;
    }
    this.hideNav.set(current.data['hideNav'] === true);
  }

  ngOnDestroy(): void {
    if (this.clockHandle) {
      clearInterval(this.clockHandle);
    }
    this.navSubscription?.unsubscribe();
  }

  openHelp(): void {
    this.helpOpen.set(true);
  }

  closeHelp(): void {
    this.helpOpen.set(false);
  }
}

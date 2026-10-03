import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { pickBackgroundUrl } from '../../core/background-picker';
import { DEFAULT_THEME_COLOR } from '../../core/models/theme-color.model';
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

  /** Brand colour picked by the restaurant (drives the [data-accent] palette). */
  readonly accent = computed(() => this.session.menu()?.restaurant?.themeColor ?? DEFAULT_THEME_COLOR);

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
    const table = this.route.snapshot.queryParamMap.get('t');
    this.session.init(slug, table);
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

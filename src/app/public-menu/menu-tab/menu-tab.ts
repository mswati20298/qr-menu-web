import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, signal, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { PublicCategory, PublicMenuItem } from '../../core/models/public-menu.model';
import { CartService } from '../../core/services/cart.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { ThemeService } from '../../core/services/theme.service';
import { UploadService } from '../../core/services/upload.service';
import { RequestActions } from '../components/request-actions/request-actions';
import { CategoryPills } from '../components/category-pills/category-pills';
import { MenuListItem } from '../components/menu-list-item/menu-list-item';
import { CustomizeSheetResult, ItemCustomizeSheet } from '../components/item-customize-sheet/item-customize-sheet';
import { VegBadge } from '../../shared/veg-badge/veg-badge';

type DietFilter = 'all' | 'veg' | 'nonveg';

@Component({
  selector: 'app-menu-tab',
  imports: [CategoryPills, MenuListItem, ItemCustomizeSheet, RequestActions, VegBadge],
  templateUrl: './menu-tab.html',
  styleUrl: './menu-tab.scss'
})
export class MenuTab implements AfterViewInit, OnDestroy {
  readonly session = inject(PublicSessionService);
  readonly cart = inject(CartService);
  readonly theme = inject(ThemeService);
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);

  private readonly sections = viewChildren<ElementRef<HTMLElement>>('categorySection');
  private observer: IntersectionObserver | null = null;

  readonly searchTerm = signal('');
  readonly activeCategoryId = signal<string | null>(null);
  readonly activeItem = signal<PublicMenuItem | null>(null);
  /** All dishes, only veg, or only non-veg. */
  readonly diet = signal<DietFilter>('all');

  private readonly allItems = computed(() => this.session.menu()?.categories.flatMap((c) => c.items) ?? []);
  readonly vegCount = computed(() => this.allItems().filter((i) => i.isVeg).length);
  readonly nonVegCount = computed(() => this.allItems().filter((i) => !i.isVeg).length);
  /** The filter is pointless on an all-veg (or all non-veg) menu, so it only shows when there are both. */
  readonly showDietFilter = computed(() => this.vegCount() > 0 && this.nonVegCount() > 0);

  readonly initials = computed(() => {
    const name = this.session.menu()?.restaurant?.name ?? '';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || 'R'
    );
  });

  readonly filteredCategories = computed<PublicCategory[]>(() => {
    const data = this.session.menu();
    if (!data) {
      return [];
    }

    const term = this.searchTerm().trim().toLowerCase();
    const diet = this.diet();

    return data.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (diet === 'veg' && !item.isVeg) return false;
          if (diet === 'nonveg' && item.isVeg) return false;
          if (term && !item.name.toLowerCase().includes(term)) return false;
          return true;
        })
      }))
      .filter((category) => category.items.length > 0);
  });

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id) {
              this.activeCategoryId.set(id);
            }
            break;
          }
        }
      },
      { rootMargin: '-120px 0px -70% 0px', threshold: 0 }
    );

    for (const section of this.sections()) {
      this.observer.observe(section.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollToCategory(id: string | null): void {
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = this.sections().find((s) => s.nativeElement.getAttribute('data-category-id') === id);
    target?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  resolveImageUrl(url: string | null): string | null {
    return this.uploadService.resolveUrl(url);
  }

  isOpenNow(): boolean {
    return this.session.menu()?.restaurant?.isOpenNow ?? true;
  }

  /** False when the restaurant's plan has run out (the menu can still be browsed). */
  orderingEnabled(): boolean {
    return this.session.menu()?.restaurant?.orderingEnabled ?? true;
  }

  canOrder(): boolean {
    return this.isOpenNow() && this.orderingEnabled();
  }

  formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  onItemOpen(item: PublicMenuItem): void {
    if (!this.canOrder()) {
      return;
    }
    if (item.variants.length > 0) {
      this.activeItem.set(item);
    } else {
      this.router.navigate(['/m', this.session.slug(), 'item', item.id]);
    }
  }

  closeSheet(): void {
    this.activeItem.set(null);
  }

  confirmFromSheet(result: CustomizeSheetResult): void {
    const item = this.activeItem();
    if (!item) {
      return;
    }

    this.cart.add(
      item.id,
      item.name,
      this.resolveImageUrl(item.imageUrl),
      result.variantId,
      result.variantName,
      result.unitPrice,
      result.addOns,
      result.qty
    );

    this.activeItem.set(null);
  }

  quickAdd(item: PublicMenuItem): void {
    if (!this.canOrder()) {
      return;
    }
    // A dish with sizes always goes through the size sheet (default size pre-selected), never a bare add.
    if (item.variants.length > 0) {
      this.activeItem.set(item);
      return;
    }
    this.cart.quickAdd(item.id, item.name, this.resolveImageUrl(item.imageUrl), item.price);
  }

  quickIncrement(item: PublicMenuItem): void {
    this.cart.quickIncrement(item.id);
  }

  quickDecrement(item: PublicMenuItem): void {
    this.cart.quickDecrement(item.id);
  }

  goToCart(): void {
    this.router.navigate(['/m', this.session.slug(), 'cart']);
  }
}

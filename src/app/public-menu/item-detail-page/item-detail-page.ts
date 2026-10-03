import { Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicItemAddOn, PublicItemVariant, PublicMenuItem } from '../../core/models/public-menu.model';
import { CartLineAddOn } from '../../core/models/cart.model';
import { CartService } from '../../core/services/cart.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { UploadService } from '../../core/services/upload.service';
import { VegBadge } from '../../shared/veg-badge/veg-badge';

@Component({
  selector: 'app-item-detail-page',
  imports: [VegBadge],
  templateUrl: './item-detail-page.html',
  styleUrl: './item-detail-page.scss'
})
export class ItemDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly uploadService = inject(UploadService);
  readonly session = inject(PublicSessionService);
  private readonly cart = inject(CartService);

  readonly item = signal<PublicMenuItem | null>(null);
  readonly selectedVariantId = signal<string | null>(null);
  readonly selectedAddOnIds = signal<Set<string>>(new Set());
  readonly qty = signal(1);
  readonly justAdded = signal(false);

  readonly selectedVariant = computed<PublicItemVariant | null>(() => {
    const item = this.item();
    const variantId = this.selectedVariantId();
    if (!item || !variantId) {
      return null;
    }
    return item.variants.find((v) => v.id === variantId) ?? null;
  });

  readonly selectedAddOns = computed<PublicItemAddOn[]>(() => {
    const item = this.item();
    if (!item) {
      return [];
    }
    const ids = this.selectedAddOnIds();
    return item.addOns.filter((a) => ids.has(a.id));
  });

  readonly unitPrice = computed(() => {
    const item = this.item();
    if (!item) {
      return 0;
    }
    const base = this.selectedVariant()?.price ?? item.price;
    const addOnsTotal = this.selectedAddOns().reduce((sum, a) => sum + a.price, 0);
    return base + addOnsTotal;
  });

  readonly totalForQty = computed(() => this.unitPrice() * this.qty());

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? this.route.parent?.snapshot.paramMap.get('slug') ?? '';
    const itemId = this.route.snapshot.paramMap.get('itemId') ?? '';
    this.session.init(slug, this.session.tableNumber());

    const tryFind = () => {
      const found = this.session.findItem(itemId);
      if (found) {
        this.item.set(found);
        const defaultVariant = found.variants.find((v) => v.isDefault) ?? found.variants[0];
        this.selectedVariantId.set(defaultVariant?.id ?? null);
      }
    };

    if (this.session.menu()) {
      tryFind();
    } else {
      const interval = setInterval(() => {
        if (this.session.menu() || this.session.loadError()) {
          tryFind();
          clearInterval(interval);
        }
      }, 100);
    }
  }

  resolveImageUrl(url: string | null): string | null {
    return this.uploadService.resolveUrl(url);
  }

  selectVariant(variantId: string): void {
    this.selectedVariantId.set(variantId);
  }

  toggleAddOn(addOnId: string): void {
    const current = new Set(this.selectedAddOnIds());
    if (current.has(addOnId)) {
      current.delete(addOnId);
    } else {
      current.add(addOnId);
    }
    this.selectedAddOnIds.set(current);
  }

  incrementQty(): void {
    this.qty.set(this.qty() + 1);
  }

  decrementQty(): void {
    this.qty.set(Math.max(1, this.qty() - 1));
  }

  addToCart(): void {
    const item = this.item();
    if (!item) {
      return;
    }

    const addOns: CartLineAddOn[] = this.selectedAddOns().map((a) => ({ id: a.id, name: a.name, price: a.price }));
    const variant = this.selectedVariant();

    this.cart.add(
      item.id,
      item.name,
      this.resolveImageUrl(item.imageUrl),
      variant?.id ?? null,
      variant?.name ?? null,
      variant?.price ?? item.price,
      addOns,
      this.qty()
    );

    this.justAdded.set(true);
    setTimeout(() => this.goBack(), 500);
  }

  goBack(): void {
    this.location.back();
  }
}

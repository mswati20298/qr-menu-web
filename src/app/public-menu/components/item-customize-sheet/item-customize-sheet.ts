import { Component, HostListener, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { PublicItemAddOn, PublicItemVariant, PublicMenuItem } from '../../../core/models/public-menu.model';
import { CartLineAddOn } from '../../../core/models/cart.model';
import { UploadService } from '../../../core/services/upload.service';
import { VegBadge } from '../../../shared/veg-badge/veg-badge';

export interface CustomizeSheetResult {
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  addOns: CartLineAddOn[];
  qty: number;
}

@Component({
  selector: 'app-item-customize-sheet',
  imports: [VegBadge],
  templateUrl: './item-customize-sheet.html',
  styleUrl: './item-customize-sheet.scss'
})
export class ItemCustomizeSheet implements OnInit {
  private readonly uploadService = inject(UploadService);

  readonly item = input.required<PublicMenuItem>();

  readonly close = output<void>();
  readonly confirm = output<CustomizeSheetResult>();

  readonly selectedVariantId = signal<string | null>(null);
  readonly selectedAddOnIds = signal<Set<string>>(new Set());
  readonly qty = signal(1);

  readonly imageUrl = computed(() => this.uploadService.thumbUrl(this.item().imageUrl, 320));

  readonly selectedVariant = computed<PublicItemVariant | null>(() => {
    const variantId = this.selectedVariantId();
    if (!variantId) {
      return null;
    }
    return this.item().variants.find((v) => v.id === variantId) ?? null;
  });

  readonly selectedAddOns = computed<PublicItemAddOn[]>(() => {
    const ids = this.selectedAddOnIds();
    return this.item().addOns.filter((a) => ids.has(a.id));
  });

  readonly basePrice = computed(() => this.selectedVariant()?.price ?? this.item().price);
  readonly unitPrice = computed(() => this.basePrice() + this.selectedAddOns().reduce((sum, a) => sum + a.price, 0));
  readonly totalForQty = computed(() => this.unitPrice() * this.qty());

  ngOnInit(): void {
    const item = this.item();
    const defaultVariant = item.variants.find((v) => v.isDefault) ?? item.variants[0];
    this.selectedVariantId.set(defaultVariant?.id ?? null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
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

  onConfirm(): void {
    const variant = this.selectedVariant();
    const addOns: CartLineAddOn[] = this.selectedAddOns().map((a) => ({ id: a.id, name: a.name, price: a.price }));

    this.confirm.emit({
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      unitPrice: this.basePrice(),
      addOns,
      qty: this.qty()
    });
  }
}

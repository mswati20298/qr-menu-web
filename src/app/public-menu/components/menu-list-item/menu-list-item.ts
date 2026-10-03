import { Component, computed, input, output } from '@angular/core';
import { PublicMenuItem } from '../../../core/models/public-menu.model';
import { VegBadge } from '../../../shared/veg-badge/veg-badge';

@Component({
  selector: 'app-menu-list-item',
  imports: [VegBadge],
  templateUrl: './menu-list-item.html',
  styleUrl: './menu-list-item.scss'
})
export class MenuListItem {
  readonly item = input.required<PublicMenuItem>();
  readonly imageUrl = input<string | null>(null);
  readonly qty = input<number>(0);
  readonly disabled = input(false);

  readonly open = output<void>();
  readonly add = output<void>();
  readonly increment = output<void>();
  readonly decrement = output<void>();

  readonly hasVariants = computed(() => this.item().variants.length > 0);

  readonly priceLabel = computed(() => {
    const item = this.item();
    if (item.variants.length > 0) {
      const min = Math.min(...item.variants.map((v) => v.price));
      return `From ₹${min}`;
    }
    return `₹${item.price}`;
  });

  onRowClick(): void {
    if (this.disabled()) {
      return;
    }
    this.open.emit();
  }

  onQuickAddClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.add.emit();
  }

  onIncrementClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.increment.emit();
  }

  onDecrementClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.decrement.emit();
  }
}

import { firstValueFrom } from 'rxjs';
import { Component, OnInit, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { Category } from '../../core/models/category.model';
import { MenuItem, UpdateItemRequest } from '../../core/models/item.model';
import { CategoryService } from '../../core/services/category.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { ItemService } from '../../core/services/item.service';
import { downloadCsv, menuToCsv } from '../../core/services/report-export.util';
import { UploadService } from '../../core/services/upload.service';
import { errorMessage } from '../../core/utils/http-error';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { VegBadge } from '../../shared/veg-badge/veg-badge';
import { CategoryList } from './components/category-list/category-list';
import { ItemModal, ItemModalResult } from './components/item-modal/item-modal';
import { MenuScanModal } from './components/menu-scan-modal/menu-scan-modal';

type PendingDelete = { kind: 'category'; id: string; name: string } | { kind: 'item'; id: string; name: string };

@Component({
  selector: 'app-menu-page',
  imports: [CategoryList, ItemModal, VegBadge, ConfirmDialog, MenuScanModal],
  templateUrl: './menu-page.html',
  styleUrl: './menu-page.scss'
})
export class MenuPage implements OnInit {
  readonly categories = signal<Category[]>([]);
  readonly items = signal<MenuItem[]>([]);
  readonly loading = signal(true);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editingItem = signal<MenuItem | null>(null);
  readonly searchTerm = signal('');
  readonly openItemMenuId = signal<string | null>(null);
  readonly uploadingItemId = signal<string | null>(null);
  readonly pendingDelete = signal<PendingDelete | null>(null);
  readonly scanModalOpen = signal(false);
  readonly importBanner = signal<string | null>(null);

  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');
  private photoUploadTargetId: string | null = null;

  readonly filteredItems = computed(() => {
    const categoryId = this.selectedCategoryId();
    const term = this.searchTerm().trim().toLowerCase();
    let items = this.items();
    if (categoryId) {
      items = items.filter((item) => item.categoryId === categoryId);
    }
    if (term) {
      items = items.filter((item) => item.name.toLowerCase().includes(term));
    }
    return items;
  });

  readonly missingPhotoCount = computed(() => this.items().filter((i) => !i.imageUrl).length);

  private readonly toast = inject(FeedbackService);

  /** Error handler that shows the API's reason (e.g. "There is already a category called ...") in a toast. */
  private fail(fallback: string) {
    return (err: unknown) => this.toast.error(errorMessage(err, fallback));
  }

  constructor(
    private readonly categoryService: CategoryService,
    private readonly itemService: ItemService,
    private readonly uploadService: UploadService
  ) {}

  /** The whole menu as a spreadsheet, in the order guests see it. */
  exportMenu(): void {
    const order = new Map(this.categories().map((c) => [c.id, c.sortOrder]));
    const items = [...this.items()].sort(
      (a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0) || a.sortOrder - b.sortOrder
    );
    downloadCsv(menuToCsv(items), `menu-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.categoryService.getAll().subscribe((categories) => this.categories.set(categories));
    this.itemService.getAll().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  resolveImageUrl(url: string | null): string | null {
    return this.uploadService.thumbUrl(url, 160);
  }

  onAddCategory(name: string): void {
    this.categoryService.create({ name }).subscribe({
      next: (category) => this.categories.set([...this.categories(), category]),
      error: this.fail('Could not add the category.')
    });
  }

  onRenameCategory(payload: { id: string; name: string }): void {
    this.categoryService.update(payload.id, { name: payload.name }).subscribe({
      next: (updated) => this.categories.set(this.categories().map((c) => (c.id === updated.id ? updated : c))),
      error: this.fail('Could not rename the category.')
    });
  }

  requestDeleteCategory(id: string): void {
    const category = this.categories().find((c) => c.id === id);
    if (!category) {
      return;
    }
    this.pendingDelete.set({ kind: 'category', id, name: category.name });
  }

  onReorderCategories(ids: string[]): void {
    const byId = new Map(this.categories().map((c) => [c.id, c]));
    const reordered = ids.map((id) => byId.get(id)).filter((c): c is Category => !!c);
    this.categories.set(reordered);
    this.categoryService.reorder(ids).subscribe({ error: this.fail('Could not save the new order.') });
  }

  openAddItemModal(): void {
    this.editingItem.set(null);
    this.itemError.set(null);
    this.modalOpen.set(true);
  }

  openEditItemModal(item: MenuItem): void {
    this.editingItem.set(item);
    this.itemError.set(null);
    this.modalOpen.set(true);
    this.openItemMenuId.set(null);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  readonly itemSaving = signal(false);
  readonly itemError = signal<string | null>(null);

  async onSaveItem(result: ItemModalResult): Promise<void> {
    if (this.itemSaving()) {
      return;
    }
    this.itemSaving.set(true);
    this.itemError.set(null);
    const { newCategoryName, ...item } = result;
    try {
      if (newCategoryName) {
        const category = await firstValueFrom(this.categoryService.create({ name: newCategoryName }));
        this.categories.set([...this.categories(), category]);
        item.categoryId = category.id;
      }
      const editing = this.editingItem();
      if (editing) {
        const updated = await firstValueFrom(this.itemService.update(editing.id, item));
        this.items.set(this.items().map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await firstValueFrom(this.itemService.create(item));
        this.items.set([...this.items(), created]);
      }
      this.refreshCategoryCounts();
      this.modalOpen.set(false);
    } catch (err) {
      this.itemError.set(errorMessage(err, 'Could not save the dish. Please try again.'));
    } finally {
      this.itemSaving.set(false);
    }
  }

  toggleItemMenu(itemId: string): void {
    this.openItemMenuId.set(this.openItemMenuId() === itemId ? null : itemId);
  }

  closeItemMenu(): void {
    this.openItemMenuId.set(null);
  }

  requestDeleteItem(item: MenuItem): void {
    this.closeItemMenu();
    this.pendingDelete.set({ kind: 'item', id: item.id, name: item.name });
  }

  confirmPendingDelete(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!pending) {
      return;
    }

    if (pending.kind === 'category') {
      this.categoryService.delete(pending.id).subscribe({
        next: () => {
          this.categories.set(this.categories().filter((c) => c.id !== pending.id));
          this.items.set(this.items().filter((i) => i.categoryId !== pending.id));
          if (this.selectedCategoryId() === pending.id) {
            this.selectedCategoryId.set(null);
          }
        },
        error: this.fail('Could not delete the category.')
      });
    } else {
      this.itemService.delete(pending.id).subscribe({
        next: () => {
          this.items.set(this.items().filter((i) => i.id !== pending.id));
          this.refreshCategoryCounts();
        },
        error: this.fail('Could not delete the dish.')
      });
    }
  }

  dismissPendingDelete(): void {
    this.pendingDelete.set(null);
  }

  onToggleAvailability(item: MenuItem): void {
    this.itemService.setAvailability(item.id, !item.isAvailable).subscribe({
      next: (updated) => this.items.set(this.items().map((i) => (i.id === updated.id ? updated : i))),
      error: this.fail('Could not change availability.')
    });
  }

  triggerPhotoUpload(item: MenuItem): void {
    this.photoUploadTargetId = item.id;
    this.photoInput()?.nativeElement.click();
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const itemId = this.photoUploadTargetId;
    input.value = '';
    if (!file || !itemId) {
      return;
    }

    const item = this.items().find((i) => i.id === itemId);
    if (!item) {
      return;
    }

    this.uploadingItemId.set(itemId);
    this.uploadService.uploadImage(file).subscribe({
      next: (result) => {
        const request: UpdateItemRequest = {
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: result.url,
          isVeg: item.isVeg,
          tag: item.tag,
          variants: item.variants.map((v) => ({ name: v.name, price: v.price, isDefault: v.isDefault })),
          addOns: item.addOns.map((a) => ({ name: a.name, price: a.price }))
        };
        this.itemService.update(itemId, request).subscribe({
          next: (updated) => {
            this.items.set(this.items().map((i) => (i.id === updated.id ? updated : i)));
            this.uploadingItemId.set(null);
          },
          error: () => this.uploadingItemId.set(null)
        });
      },
      error: () => this.uploadingItemId.set(null)
    });
  }

  private refreshCategoryCounts(): void {
    this.categoryService.getAll().subscribe((categories) => this.categories.set(categories));
  }

  openScanModal(): void {
    this.scanModalOpen.set(true);
  }

  closeScanModal(): void {
    this.scanModalOpen.set(false);
  }

  onMenuScanned(result: { itemCount: number; categoryCount: number; skippedCount: number }): void {
    this.scanModalOpen.set(false);
    const categoryNote =
      result.categoryCount > 0 ? ` across ${result.categoryCount} new categor${result.categoryCount === 1 ? 'y' : 'ies'}` : '';
    this.importBanner.set(`Imported ${result.itemCount} item${result.itemCount === 1 ? '' : 's'}${categoryNote}.${result.skippedCount > 0 ? ` Skipped ${result.skippedCount} already on the menu.` : ''}`);
    this.reload();
    setTimeout(() => this.importBanner.set(null), 6000);
  }
}

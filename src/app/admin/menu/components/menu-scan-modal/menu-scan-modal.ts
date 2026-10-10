import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Category } from '../../../../core/models/category.model';
import { CategoryService } from '../../../../core/services/category.service';
import { ItemService } from '../../../../core/services/item.service';
import { MenuScanService } from '../../../../core/services/menu-scan.service';
import { errorMessage } from '../../../../core/utils/http-error';

type Step = 'upload' | 'scanning' | 'review' | 'importing';

interface ReviewItem {
  id: string;
  include: boolean;
  category: string;
  name: string;
  price: number | null;
  isVeg: boolean;
  description: string | null;
}

@Component({
  selector: 'app-menu-scan-modal',
  templateUrl: './menu-scan-modal.html',
  styleUrl: './menu-scan-modal.scss'
})
export class MenuScanModal {
  readonly categories = input.required<Category[]>();

  readonly close = output<void>();
  /** skippedCount = items that were already on the menu (same name in the same category). */
  readonly imported = output<{ itemCount: number; categoryCount: number; skippedCount: number }>();

  private readonly menuScanService = inject(MenuScanService);
  private readonly categoryService = inject(CategoryService);
  private readonly itemService = inject(ItemService);

  readonly step = signal<Step>('upload');
  readonly files = signal<File[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly reviewItems = signal<ReviewItem[]>([]);
  /** Rows whose price is missing (highlighted after a try to import). */
  readonly missingPriceIds = signal<Set<string>>(new Set());
  readonly importProgress = signal<{ done: number; total: number } | null>(null);

  private nextId = 0;

  get filePreviewUrls(): { file: File; url: string }[] {
    return this.files().map((file) => ({ file, url: URL.createObjectURL(file) }));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    if (picked.length === 0) {
      return;
    }
    const combined = [...this.files(), ...picked].slice(0, 5);
    this.files.set(combined);
    this.errorMessage.set(null);
  }

  removeFile(file: File): void {
    this.files.set(this.files().filter((f) => f !== file));
  }

  startScan(): void {
    if (this.files().length === 0) {
      this.errorMessage.set('Add at least one photo of your menu first.');
      return;
    }

    this.step.set('scanning');
    this.errorMessage.set(null);

    this.menuScanService.scan(this.files()).subscribe({
      next: (result) => {
        this.reviewItems.set(
          result.items.map((item) => ({
            id: `scan-${++this.nextId}`,
            include: true,
            category: item.category,
            name: item.name,
            price: item.price,
            isVeg: item.isVeg,
            description: item.description
          }))
        );
        this.step.set(this.reviewItems().length > 0 ? 'review' : 'upload');
        if (this.reviewItems().length === 0) {
          this.errorMessage.set('No dishes were found in that photo. Try a clearer, well-lit photo.');
        }
      },
      error: (err) => {
        this.step.set('upload');
        this.errorMessage.set(errorMessage(err, 'Could not scan that menu. Please try again.'));
      }
    });
  }

  updateItem(id: string, patch: Partial<ReviewItem>): void {
    this.reviewItems.set(this.reviewItems().map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  removeReviewItem(id: string): void {
    this.reviewItems.set(this.reviewItems().filter((i) => i.id !== id));
  }

  get includedCount(): number {
    return this.reviewItems().filter((i) => i.include).length;
  }

  async confirmImport(): Promise<void> {
    const included = this.reviewItems().filter((i) => i.include && i.name.trim());
    if (included.length === 0) {
      this.errorMessage.set('Select at least one item to import.');
      return;
    }
    // A dish needs a price: say which ones, before anything is saved.
    const noPrice = included.filter((i) => !(i.price && i.price > 0));
    if (noPrice.length > 0) {
      const names = noPrice.slice(0, 3).map((i) => i.name.trim()).join(', ');
      this.errorMessage.set(
        `Enter a price for ${names}${noPrice.length > 3 ? ` and ${noPrice.length - 3} more` : ''} (or untick ${noPrice.length === 1 ? 'it' : 'them'}).`
      );
      this.missingPriceIds.set(new Set(noPrice.map((i) => i.id)));
      return;
    }
    this.missingPriceIds.set(new Set());

    this.step.set('importing');
    this.errorMessage.set(null);
    this.importProgress.set({ done: 0, total: included.length });

    try {
      // Same rule as the API: names match ignoring case and extra spaces.
      const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
      const categoryIdByName = new Map<string, string>();
      // The server's list, not the one the page had: a retry after a half-done import must reuse what it created.
      const categories = await firstValueFrom(this.categoryService.getAll()).catch(() => this.categories());
      for (const c of categories) {
        categoryIdByName.set(key(c.name), c.id);
      }
      let newCategoryCount = 0;
      let createdCount = 0;
      let skippedCount = 0;
      /** "<categoryId>|<item name>" already sent in this import, so a scan that lists a dish twice adds it once. */
      const seen = new Set<string>();

      for (const item of included) {
        const categoryKey = key(item.category) || 'other';
        let categoryId = categoryIdByName.get(categoryKey);
        if (!categoryId) {
          const created = await firstValueFrom(this.categoryService.create({ name: item.category.trim() || 'Other' }));
          categoryId = created.id;
          categoryIdByName.set(categoryKey, categoryId);
          newCategoryCount++;
        }

        const itemKey = `${categoryId}|${key(item.name)}`;
        if (seen.has(itemKey)) {
          skippedCount++;
          this.importProgress.set({ done: (this.importProgress()?.done ?? 0) + 1, total: included.length });
          continue;
        }
        seen.add(itemKey);

        const created = await firstValueFrom(
          this.itemService.create({
            categoryId,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            price: item.price ?? 0,
            imageUrl: null,
            isVeg: item.isVeg,
            tag: null,
            variants: [],
            addOns: []
          })
        ).then(
          () => true,
          (err: { status?: number }) => {
            // 409: this dish is already on the menu. Skip it and keep importing the rest.
            if (err?.status === 409) {
              return false;
            }
            throw err;
          }
        );
        if (created) {
          createdCount++;
        } else {
          skippedCount++;
        }

        this.importProgress.set({ done: (this.importProgress()?.done ?? 0) + 1, total: included.length });
      }

      this.imported.emit({ itemCount: createdCount, categoryCount: newCategoryCount, skippedCount });
    } catch (err) {
      this.errorMessage.set(
        `${errorMessage(err, 'Something went wrong while importing.')} Dishes imported before this were saved; fix this one and import again (saved dishes are skipped).`
      );
      this.step.set('review');
    }
  }
}

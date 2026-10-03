import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Category } from '../../../../core/models/category.model';
import { CategoryService } from '../../../../core/services/category.service';
import { ItemService } from '../../../../core/services/item.service';
import { MenuScanService } from '../../../../core/services/menu-scan.service';

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
  readonly imported = output<{ itemCount: number; categoryCount: number }>();

  private readonly menuScanService = inject(MenuScanService);
  private readonly categoryService = inject(CategoryService);
  private readonly itemService = inject(ItemService);

  readonly step = signal<Step>('upload');
  readonly files = signal<File[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly reviewItems = signal<ReviewItem[]>([]);
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
        this.errorMessage.set(err?.error?.message ?? 'Could not scan that menu. Please try again.');
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

    this.step.set('importing');
    this.errorMessage.set(null);
    this.importProgress.set({ done: 0, total: included.length });

    try {
      const categoryIdByName = new Map<string, string>();
      for (const c of this.categories()) {
        categoryIdByName.set(c.name.trim().toLowerCase(), c.id);
      }
      let newCategoryCount = 0;

      for (const item of included) {
        const key = item.category.trim().toLowerCase() || 'other';
        let categoryId = categoryIdByName.get(key);
        if (!categoryId) {
          const created = await firstValueFrom(this.categoryService.create({ name: item.category.trim() || 'Other' }));
          categoryId = created.id;
          categoryIdByName.set(key, categoryId);
          newCategoryCount++;
        }

        await firstValueFrom(
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
        );

        this.importProgress.set({ done: (this.importProgress()?.done ?? 0) + 1, total: included.length });
      }

      this.imported.emit({ itemCount: included.length, categoryCount: newCategoryCount });
    } catch {
      this.errorMessage.set('Something went wrong while importing. Items already imported were saved — you can retry the rest manually.');
      this.step.set('review');
    }
  }
}

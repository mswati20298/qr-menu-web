import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../../core/models/category.model';
import { AddOnInput, MenuItem, VariantInput } from '../../../../core/models/item.model';
import { UploadService } from '../../../../core/services/upload.service';

export interface ItemModalResult {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  tag: string | null;
  variants: VariantInput[];
  addOns: AddOnInput[];
}

@Component({
  selector: 'app-item-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './item-modal.html',
  styleUrl: './item-modal.scss'
})
export class ItemModal implements OnInit {
  readonly categories = input.required<Category[]>();
  readonly editingItem = input<MenuItem | null>(null);

  readonly save = output<ItemModalResult>();
  readonly close = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly uploadService = inject(UploadService);

  readonly uploading = signal(false);
  readonly imagePreviewUrl = signal<string | null>(null);
  readonly variantRows = signal<VariantInput[]>([]);
  readonly addOnRows = signal<AddOnInput[]>([]);

  readonly form = this.fb.group({
    categoryId: this.fb.control('', [Validators.required]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    description: this.fb.control(''),
    price: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    isVeg: this.fb.control(true),
    tag: this.fb.control(''),
    imageUrl: this.fb.control<string | null>(null)
  });

  ngOnInit(): void {
    const item = this.editingItem();
    if (item) {
      this.form.patchValue({
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? '',
        price: item.price,
        isVeg: item.isVeg,
        tag: item.tag ?? '',
        imageUrl: item.imageUrl
      });
      this.imagePreviewUrl.set(this.uploadService.resolveUrl(item.imageUrl));
      this.variantRows.set(item.variants.map((v) => ({ name: v.name, price: v.price, isDefault: v.isDefault })));
      this.addOnRows.set(item.addOns.map((a) => ({ name: a.name, price: a.price })));
    } else if (this.categories().length > 0) {
      this.form.patchValue({ categoryId: this.categories()[0].id });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.uploadService.uploadImage(file).subscribe({
      next: (result) => {
        this.form.patchValue({ imageUrl: result.url });
        this.imagePreviewUrl.set(this.uploadService.resolveUrl(result.url));
        this.uploading.set(false);
      },
      error: () => {
        this.uploading.set(false);
      }
    });
  }

  addVariantRow(): void {
    this.variantRows.set([...this.variantRows(), { name: '', price: 0, isDefault: this.variantRows().length === 0 }]);
  }

  updateVariant(index: number, patch: Partial<VariantInput>): void {
    this.variantRows.set(this.variantRows().map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  setDefaultVariant(index: number): void {
    this.variantRows.set(this.variantRows().map((v, i) => ({ ...v, isDefault: i === index })));
  }

  removeVariant(index: number): void {
    const rows = this.variantRows().filter((_, i) => i !== index);
    if (rows.length > 0 && !rows.some((r) => r.isDefault)) {
      rows[0].isDefault = true;
    }
    this.variantRows.set(rows);
  }

  addAddOnRow(): void {
    this.addOnRows.set([...this.addOnRows(), { name: '', price: 0 }]);
  }

  updateAddOn(index: number, patch: Partial<AddOnInput>): void {
    this.addOnRows.set(this.addOnRows().map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  removeAddOn(index: number): void {
    this.addOnRows.set(this.addOnRows().filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const validVariants = this.variantRows().filter((v) => v.name.trim().length > 0 && v.price > 0);
    const validAddOns = this.addOnRows().filter((a) => a.name.trim().length > 0);

    const value = this.form.getRawValue();
    this.save.emit({
      categoryId: value.categoryId!,
      name: value.name!.trim(),
      description: value.description?.trim() || null,
      price: value.price!,
      imageUrl: value.imageUrl,
      isVeg: value.isVeg!,
      tag: value.tag?.trim() || null,
      variants: validVariants,
      addOns: validAddOns
    });
  }
}

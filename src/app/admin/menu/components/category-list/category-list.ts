import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, input, output, signal } from '@angular/core';
import { Category } from '../../../../core/models/category.model';

@Component({
  selector: 'app-category-list',
  imports: [CdkDropList, CdkDrag],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss'
})
export class CategoryList {
  readonly categories = input.required<Category[]>();
  readonly selectedCategoryId = input<string | null>(null);

  readonly select = output<string | null>();
  readonly add = output<string>();
  readonly rename = output<{ id: string; name: string }>();
  readonly remove = output<string>();
  readonly reorder = output<string[]>();

  readonly newCategoryName = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly openMenuId = signal<string | null>(null);

  submitNew(): void {
    const name = this.newCategoryName().trim();
    if (!name) {
      return;
    }
    this.add.emit(name);
    this.newCategoryName.set('');
  }

  toggleMenu(id: string): void {
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  startEdit(category: Category): void {
    this.editingId.set(category.id);
    this.editingName.set(category.name);
    this.closeMenu();
  }

  saveEdit(): void {
    const id = this.editingId();
    const name = this.editingName().trim();
    if (id && name) {
      this.rename.emit({ id, name });
    }
    this.editingId.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  requestDelete(id: string): void {
    this.closeMenu();
    this.remove.emit(id);
  }

  onDrop(event: CdkDragDrop<Category[]>): void {
    const reordered = [...this.categories()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.reorder.emit(reordered.map((c) => c.id));
  }
}

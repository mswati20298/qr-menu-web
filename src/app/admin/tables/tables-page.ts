import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantTable } from '../../core/models/table.model';
import { QrService } from '../../core/services/qr.service';
import { TableService } from '../../core/services/table.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { errorMessage } from '../../core/utils/http-error';

@Component({
  selector: 'app-tables-page',
  imports: [ReactiveFormsModule],
  templateUrl: './tables-page.html',
  styleUrl: './tables-page.scss'
})
export class TablesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tableService = inject(TableService);
  private readonly qrService = inject(QrService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly tables = signal<RestaurantTable[]>([]);
  readonly loading = signal(true);
  readonly previewTableId = signal<string | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.group({
    number: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    capacity: this.fb.control<number | null>(null)
  });

  readonly editForm = this.fb.group({
    number: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    capacity: this.fb.control<number | null>(null),
    isActive: this.fb.control(true)
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.tableService.getAll().subscribe({
      next: (tables) => {
        this.tables.set(tables);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  addTable(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.tableService.create({ number: value.number!, capacity: value.capacity }).subscribe((table) => {
      this.tables.set([...this.tables(), table]);
      this.form.reset({ number: '', capacity: null });
    });
  }

  startEdit(table: RestaurantTable): void {
    this.editingId.set(table.id);
    this.editForm.setValue({ number: table.number, capacity: table.capacity, isActive: table.isActive });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    if (this.editForm.invalid) {
      return;
    }
    const value = this.editForm.getRawValue();
    this.tableService.update(id, { number: value.number!, capacity: value.capacity, isActive: value.isActive! }).subscribe((updated) => {
      this.tables.set(this.tables().map((t) => (t.id === updated.id ? updated : t)));
      this.editingId.set(null);
    });
  }

  async deleteTable(table: RestaurantTable): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Delete Table ${table.number}?`,
      message: 'Its QR code stops working. Past orders from this table are kept.',
      confirmLabel: 'Delete table',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.tableService.delete(table.id).subscribe({
      next: () => {
        this.tables.set(this.tables().filter((t) => t.id !== table.id));
        this.feedback.success(`Table ${table.number} deleted.`);
      },
      error: (err) => this.feedback.error(errorMessage(err, `Could not delete Table ${table.number}.`))
    });
  }

  async resetCode(table: RestaurantTable): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: `Reset Table ${table.number}'s QR code?`,
      message: 'Its printed QR stops taking orders straight away. Print the new QR for this table afterwards.',
      confirmLabel: 'Reset QR code',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.tableService.resetCode(table.id).subscribe({
      next: (updated) => {
        this.tables.set(this.tables().map((t) => (t.id === updated.id ? updated : t)));
        this.feedback.success(`Table ${table.number} has a new QR code. Download it and replace the old card.`);
        // Show the new QR straight away so it can be downloaded.
        this.previewTableId.set(null);
        this.showQrPreview(updated);
      },
      error: (err) => this.feedback.error(errorMessage(err, 'Could not reset the QR code.'))
    });
  }

  showQrPreview(table: RestaurantTable): void {
    const slug = this.authService.currentSession()?.restaurantSlug;
    if (!slug) {
      return;
    }

    if (this.previewTableId() === table.id) {
      this.previewTableId.set(null);
      this.revokePreview();
      return;
    }

    this.qrService.getTableQrPng(slug, table.number).subscribe((blob) => {
      this.revokePreview();
      this.previewUrl.set(URL.createObjectURL(blob));
      this.previewTableId.set(table.id);
    });
  }

  downloadPreview(table: RestaurantTable): void {
    const url = this.previewUrl();
    if (!url) {
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-${table.number}-qr.png`;
    link.click();
  }

  private revokePreview(): void {
    const current = this.previewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.previewUrl.set(null);
  }
}

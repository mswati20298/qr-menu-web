import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { BACKGROUND_SLOT, BackgroundItem, BackgroundMode } from '../../../core/models/background.model';
import { BackgroundService } from '../../../core/services/background.service';
import { UploadService } from '../../../core/services/upload.service';

interface SlotOption {
  bit: number;
  label: string;
  hours: string;
}

/** Settings → Background photos: upload several images, pick the default, and
 * optionally assign images to times of day. Every action saves immediately. */
@Component({
  selector: 'app-background-manager',
  templateUrl: './background-manager.html',
  styleUrl: './background-manager.scss'
})
export class BackgroundManager implements OnInit {
  private readonly service = inject(BackgroundService);
  private readonly uploadService = inject(UploadService);

  readonly maxImages = 8;
  readonly slots: SlotOption[] = [
    { bit: BACKGROUND_SLOT.Morning, label: 'Morning', hours: '5 AM – 12 PM' },
    { bit: BACKGROUND_SLOT.Afternoon, label: 'Afternoon', hours: '12 – 5 PM' },
    { bit: BACKGROUND_SLOT.Evening, label: 'Evening', hours: '5 – 8 PM' },
    { bit: BACKGROUND_SLOT.Night, label: 'Night', hours: '8 PM – 5 AM' }
  ];

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = computed(() => this.service.settings()?.items ?? []);
  readonly mode = computed<BackgroundMode>(() => this.service.settings()?.mode ?? 'Fixed');
  readonly canAdd = computed(() => this.items().length < this.maxImages);

  ngOnInit(): void {
    this.service.load().subscribe({
      error: () => this.error.set('Could not load your background images. Please refresh the page.')
    });
  }

  thumb(item: BackgroundItem): string {
    return `url("${this.uploadService.resolveUrl(item.imageUrl)}")`;
  }

  hasSlot(item: BackgroundItem, bit: number): boolean {
    return (item.slots & bit) !== 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allows picking the same file again later
    if (!file) {
      return;
    }
    this.run(this.uploadService.uploadImage(file).pipe(switchMap((result) => this.service.add(result.url))));
  }

  setMode(mode: BackgroundMode): void {
    if (mode !== this.mode()) {
      this.run(this.service.setMode(mode));
    }
  }

  makeDefault(item: BackgroundItem): void {
    this.run(this.service.update(item.id, item.slots, true));
  }

  toggleSlot(item: BackgroundItem, bit: number): void {
    this.run(this.service.update(item.id, item.slots ^ bit, item.isDefault));
  }

  remove(item: BackgroundItem): void {
    if (confirm('Delete this background image?')) {
      this.run(this.service.remove(item.id));
    }
  }

  private run(request: Observable<unknown>): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => this.busy.set(false),
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Something went wrong. Please try again.');
      }
    });
  }
}

import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Review } from '../../core/models/review.model';
import { FeedbackService } from '../../core/services/feedback.service';
import { ReviewService } from '../../core/services/review.service';
import { UploadService } from '../../core/services/upload.service';

type Kind = '' | 'owner' | 'customer';

/** Every rating from owners and guests. Published ones are the testimonials on qrenvo.com. */
@Component({
  selector: 'app-super-admin-feedback',
  imports: [DatePipe],
  templateUrl: './super-admin-feedback.html',
  styleUrl: './super-admin-feedback.scss'
})
export class SuperAdminFeedback implements OnInit {
  private readonly reviews = inject(ReviewService);
  private readonly uploads = inject(UploadService);
  private readonly toast = inject(FeedbackService);

  readonly items = signal<Review[]>([]);
  readonly loading = signal(true);
  readonly kind = signal<Kind>('');
  readonly busyId = signal<string | null>(null);

  readonly publishedCount = computed(() => this.items().filter((r) => r.isPublished).length);

  ngOnInit(): void {
    this.load();
  }

  setKind(kind: Kind): void {
    this.kind.set(kind);
    this.load();
  }

  togglePublished(review: Review): void {
    this.busyId.set(review.id);
    this.reviews.setPublished(review.id, !review.isPublished).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.items.set(this.items().map((r) => (r.id === updated.id ? updated : r)));
        this.toast.success(updated.isPublished ? 'Now shown on qrenvo.com.' : 'Hidden from qrenvo.com.');
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error('Could not save. Please try again.');
      }
    });
  }

  async remove(review: Review): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete ${review.name}'s rating?`,
      message: 'For spam or abuse. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.reviews.remove(review.id).subscribe({
      next: () => {
        this.items.set(this.items().filter((r) => r.id !== review.id));
        this.toast.success('Rating deleted.');
      },
      error: () => this.toast.error('Could not delete. Please try again.')
    });
  }

  image(review: Review): string | null {
    return this.uploads.thumbUrl(review.displayImageUrl, 160);
  }

  initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  starsText(rating: number): string {
    return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
  }

  private load(): void {
    this.loading.set(true);
    this.reviews.all(this.kind()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load the ratings.');
      }
    });
  }
}

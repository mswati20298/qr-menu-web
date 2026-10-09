import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CustomerReviewSummary, Review, ReviewInput } from '../../core/models/review.model';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { ReviewService } from '../../core/services/review.service';
import { UploadService } from '../../core/services/upload.service';
import { RatingForm } from '../../shared/rating-form/rating-form';

/** What guests said about this restaurant, and the owner's own rating of QRenvo (can appear on qrenvo.com). */
@Component({
  selector: 'app-reviews-page',
  imports: [DatePipe, RatingForm],
  templateUrl: './reviews-page.html',
  styleUrl: './reviews-page.scss'
})
export class ReviewsPage implements OnInit {
  private readonly reviews = inject(ReviewService);
  private readonly uploads = inject(UploadService);
  private readonly restaurants = inject(RestaurantService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(FeedbackService);

  readonly summary = signal<CustomerReviewSummary | null>(null);
  readonly loading = signal(true);
  readonly mine = signal<Review | null>(null);
  readonly logoUrl = signal<string | null>(null);
  readonly saving = signal(false);
  readonly filter = signal<0 | 1 | 2 | 3 | 4 | 5>(0);
  readonly Math = Math;

  readonly uploadPhoto = (file: File) => this.uploads.uploadImage(file, 'feedback');
  readonly resolveUrl = (url: string | null) => this.uploads.thumbUrl(url, 160);

  readonly myStart = computed<ReviewInput | null>(() => {
    const r = this.mine();
    if (r) {
      return { rating: r.rating, name: r.name, comment: r.comment, imageUrl: r.imageUrl };
    }
    const owner = this.auth.currentSession()?.ownerName ?? '';
    return { rating: 0, name: owner, comment: null, imageUrl: null };
  });

  readonly shownItems = computed(() => {
    const items = this.summary()?.items ?? [];
    const star = this.filter();
    return star === 0 ? items : items.filter((r) => r.rating === star);
  });

  /** Bars from 5 stars down to 1, with their share of all ratings. */
  readonly bars = computed(() => {
    const s = this.summary();
    if (!s) {
      return [];
    }
    return [5, 4, 3, 2, 1].map((star) => {
      const count = s.countByStars[star - 1] ?? 0;
      return { star, count, percent: s.count ? Math.round((count / s.count) * 100) : 0 };
    });
  });

  ngOnInit(): void {
    this.reviews.customerReviews().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.reviews.myReview().subscribe({ next: (r) => this.mine.set(r), error: () => undefined });
    this.restaurants.get().subscribe({ next: (r) => this.logoUrl.set(r.logoUrl ?? null), error: () => undefined });
  }

  saveMine(input: ReviewInput): void {
    this.saving.set(true);
    this.reviews.saveMyReview({ ...input, name: input.name ?? '' }).subscribe({
      next: (review) => {
        this.saving.set(false);
        this.mine.set(review);
        this.toast.success(review.isPublished ? 'Saved.' : 'Thank you! We will review it before it appears on qrenvo.com.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(firstError(err) ?? 'Could not save. Please try again.');
      }
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
}

function firstError(err: unknown): string | null {
  const body = (err as { error?: { errors?: unknown; message?: string } })?.error;
  const errors = body?.errors;
  if (Array.isArray(errors) && errors.length) {
    return String(errors[0]);
  }
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors as Record<string, string[]>)[0];
    if (first?.length) {
      return first[0];
    }
  }
  return body?.message ?? null;
}

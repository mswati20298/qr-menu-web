import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ReviewInput } from '../../core/models/review.model';

const LABELS = ['', 'Poor', 'Okay', 'Good', 'Very good', 'Excellent'];

/**
 * Star rating with name, comment and an optional photo. Used by guests (after ordering) and by restaurant owners
 * (rating QRenvo). Colours come from the page it sits on: admin variables first, then the customer menu's.
 */
@Component({
  selector: 'app-rating-form',
  imports: [FormsModule],
  templateUrl: './rating-form.html',
  styleUrl: './rating-form.scss'
})
export class RatingForm {
  /** Values to start from (editing an earlier rating). */
  readonly initial = input<ReviewInput | null>(null);
  readonly nameRequired = input(false);
  readonly namePlaceholder = input('Your name');
  readonly commentPlaceholder = input('Tell us what you liked…');
  readonly submitLabel = input('Send rating');
  readonly busy = input(false);
  /** Shown in the avatar when no photo is chosen (e.g. the restaurant logo); otherwise the name's first letter. */
  readonly fallbackImageUrl = input<string | null>(null);
  /** Turns an upload path into a full URL for the preview. */
  readonly resolveUrl = input<(url: string | null) => string | null>((url) => url);
  /** Uploads the chosen photo and returns its /uploads/ path. */
  readonly upload = input.required<(file: File) => Observable<{ url: string }>>();

  readonly submitted = output<ReviewInput>();

  readonly rating = signal(0);
  readonly hover = signal(0);
  readonly name = signal('');
  readonly comment = signal('');
  readonly imageUrl = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);

  readonly stars = [1, 2, 3, 4, 5];
  readonly shown = computed(() => this.hover() || this.rating());
  readonly label = computed(() => LABELS[this.shown()] ?? '');
  readonly preview = computed(() => this.resolveUrl()(this.imageUrl() ?? this.fallbackImageUrl()));
  readonly initialLetter = computed(() => (this.name().trim()[0] ?? '?').toUpperCase());
  readonly canSubmit = computed(
    () => this.rating() > 0 && !this.uploading() && !this.busy() && (!this.nameRequired() || this.name().trim().length > 0)
  );

  constructor() {
    effect(() => {
      const start = this.initial();
      if (start) {
        this.rating.set(start.rating);
        this.name.set(start.name ?? '');
        this.comment.set(start.comment ?? '');
        this.imageUrl.set(start.imageUrl);
      }
    });
  }

  pick(star: number): void {
    this.rating.set(star);
    this.error.set(null);
  }

  /** Arrow keys move the rating, like a slider. */
  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      this.rating.set(Math.min(5, this.rating() + 1));
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      this.rating.set(Math.max(1, this.rating() - 1));
      event.preventDefault();
    }
  }

  choosePhoto(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.error.set('Please choose a JPEG, PNG or WEBP photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('Please choose a photo under 10 MB.');
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.upload()(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.imageUrl.set(res.url);
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('The photo could not be uploaded. Please try again.');
      }
    });
  }

  removePhoto(): void {
    this.imageUrl.set(null);
  }

  submit(): void {
    if (this.rating() === 0) {
      this.error.set('Please tap a star to rate.');
      return;
    }
    if (this.nameRequired() && !this.name().trim()) {
      this.error.set('Please enter your name.');
      return;
    }
    this.submitted.emit({
      rating: this.rating(),
      name: this.name().trim() || null,
      comment: this.comment().trim() || null,
      imageUrl: this.imageUrl()
    });
  }
}

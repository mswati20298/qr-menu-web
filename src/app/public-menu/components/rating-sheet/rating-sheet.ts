import { Component, HostListener, input, output } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewInput } from '../../../core/models/review.model';
import { RatingForm } from '../../../shared/rating-form/rating-form';

/** "How was your experience?" in a sheet that slides up from the bottom, like the Help sheet. */
@Component({
  selector: 'app-rating-sheet',
  imports: [RatingForm],
  templateUrl: './rating-sheet.html',
  styleUrl: './rating-sheet.scss'
})
export class RatingSheet {
  readonly restaurantName = input('the restaurant');
  readonly initial = input<ReviewInput | null>(null);
  readonly busy = input(false);
  readonly editing = input(false);
  readonly upload = input.required<(file: File) => Observable<{ url: string }>>();
  readonly resolveUrl = input<(url: string | null) => string | null>((url) => url);

  readonly submitted = output<ReviewInput>();
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}

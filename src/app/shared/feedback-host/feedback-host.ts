import { Component, ElementRef, OnDestroy, effect, inject, viewChild } from '@angular/core';
import { FeedbackService } from '../../core/services/feedback.service';

/** Shows the app's toasts and toast-style confirms. Placed once, in the root component. */
@Component({
  selector: 'app-feedback-host',
  templateUrl: './feedback-host.html',
  styleUrl: './feedback-host.scss'
})
export class FeedbackHost implements OnDestroy {
  readonly feedback = inject(FeedbackService);

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private returnFocus: HTMLElement | null = null;

  // Escape cancels the confirm. Listening on window in the capture phase means Escape cancels only
  // the confirm, not also a dialog open underneath it (those listen on document).
  private readonly keyHandler = (event: KeyboardEvent) => {
    if (!this.feedback.confirmRequest()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.answer(false);
    }
  };

  // Move focus into the confirm when it opens, and back to where it was when it closes. For a destructive
  // action focus goes to Cancel, so a stray Enter never deletes anything.
  private readonly focusEffect = effect(() => {
    const request = this.feedback.confirmRequest();
    const button = request?.danger ? this.cancelButton() : this.confirmButton();
    if (request && button) {
      this.returnFocus ??= document.activeElement as HTMLElement | null;
      queueMicrotask(() => button.nativeElement.focus());
    }
  });

  constructor() {
    window.addEventListener('keydown', this.keyHandler, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.keyHandler, true);
  }

  answer(confirmed: boolean): void {
    this.feedback.answer(confirmed);
    const target = this.returnFocus;
    this.returnFocus = null;
    target?.focus?.();
  }
}

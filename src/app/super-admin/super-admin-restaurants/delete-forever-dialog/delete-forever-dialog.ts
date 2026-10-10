import { Component, computed, input, output, signal } from '@angular/core';

/** Permanent delete: the super admin types the restaurant's name, so it cannot happen by a slip of the mouse. */
@Component({
  selector: 'app-delete-forever-dialog',
  templateUrl: './delete-forever-dialog.html',
  styleUrl: './delete-forever-dialog.scss'
})
export class DeleteForeverDialog {
  readonly restaurantName = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  readonly typed = signal('');
  readonly matches = computed(() => this.typed().trim().toLowerCase() === this.restaurantName().trim().toLowerCase());

  submit(): void {
    if (this.matches() && !this.busy()) {
      this.confirmed.emit(this.typed().trim());
    }
  }
}

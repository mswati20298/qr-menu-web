import { Component, input } from '@angular/core';

@Component({
  selector: 'app-veg-badge',
  template: `
    <svg
      [attr.aria-label]="isVeg() ? 'Vegetarian' : 'Non-vegetarian'"
      role="img"
      width="16"
      height="16"
      viewBox="0 0 16 16"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="2"
        [attr.stroke]="isVeg() ? 'var(--color-veg-green)' : '#8B2E2E'"
        stroke-width="1.4"
        fill="none"
      />
      @if (isVeg()) {
        <circle cx="8" cy="8" r="4" fill="var(--color-veg-green)" />
      } @else {
        <path d="M4.5 12 L8 4 L11.5 12 Z" fill="#8B2E2E" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
    `
  ]
})
export class VegBadge {
  readonly isVeg = input.required<boolean>();
}

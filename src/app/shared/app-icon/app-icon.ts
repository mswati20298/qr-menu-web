import { Component, input } from '@angular/core';

export type AppIconName = 'bell' | 'bell-off' | 'water' | 'receipt' | 'check' | 'note' | 'fullscreen' | 'fullscreen-exit';

/**
 * Line icons in the app's style (stroke, round ends) that take the text colour, so they follow every theme.
 * Use instead of emoji: emoji look different on every phone and ignore the theme colours.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round">
      @switch (name()) {
        @case ('bell') {
          <path d="M6 10a6 6 0 1 1 12 0c0 4.2 1.4 5.8 2 6.5H4c.6-.7 2-2.3 2-6.5z" />
          <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
        }
        @case ('bell-off') {
          <path d="M8.2 4.9A6 6 0 0 1 18 10c0 2.2.4 3.7.9 4.7M17 16.5H4c.6-.7 2-2.3 2-6.5 0-.8.2-1.6.4-2.3" />
          <path d="M10 19.5a2.2 2.2 0 0 0 4 0M3 3l18 18" />
        }
        @case ('water') {
          <path d="M12 3.2c3.2 3.7 6 7.1 6 10.4a6 6 0 0 1-12 0c0-3.3 2.8-6.7 6-10.4z" />
          <path d="M9.2 14.2a2.9 2.9 0 0 0 2.6 2.7" />
        }
        @case ('receipt') {
          <path d="M6 3h12v18l-2.5-1.6L13 21l-2-1.6L8.5 21 6 19.4z" />
          <path d="M9 8h6M9 11.5h6M9 15h3.5" />
        }
        @case ('check') {
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.3 2.7 2.7L16 9.6" />
        }
        @case ('note') {
          <path d="M5 4h10l4 4v12H5z" />
          <path d="M15 4v4h4M8.5 12h7M8.5 15.5h5" />
        }
        @case ('fullscreen') {
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        }
        @case ('fullscreen-exit') {
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }']
})
export class AppIcon {
  readonly name = input.required<AppIconName>();
  readonly size = input(20);
  readonly stroke = input(1.8);
}

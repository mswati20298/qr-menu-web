import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

/** Round sun/moon button that flips light / dark mode. */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="theme-toggle"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      [title]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      @if (theme.mode() === 'dark') {
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      } @else {
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      }
    </button>
  `,
  styles: `
    .theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--field-border, var(--color-border));
      background: var(--field-bg, transparent);
      color: var(--color-text);
      cursor: pointer;
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      -webkit-tap-highlight-color: transparent;
    }
    .theme-toggle:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
}

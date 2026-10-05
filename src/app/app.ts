import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackHost } from './shared/feedback-host/feedback-host';
import { SiteService } from './core/services/site.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackHost],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Instantiated at startup so the saved theme is applied on every page.
  private readonly theme = inject(ThemeService);
  protected readonly site = inject(SiteService);
}

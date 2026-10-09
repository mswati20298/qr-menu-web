import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { readAuthAccent, readAuthBackground } from '../../core/auth-background';
import { SiteService } from '../../core/services/site.service';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';

/**
 * No password emails are sent: the owner messages support on WhatsApp, support checks it is really them and
 * sets a new password from the super admin panel (Restaurants → Reset password).
 */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, ThemeToggle],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/auth-page.scss'
})
export class ForgotPassword {
  private readonly site = inject(SiteService);

  readonly backgroundImage = readAuthBackground();
  readonly accent = readAuthAccent() ?? 'masala';
  readonly email = signal('');

  readonly whatsAppLink = computed(() => {
    const email = this.email().trim();
    return this.site.supportWhatsAppLink(
      `Hi, I forgot my QRenvo password. Please reset it.${email ? ` My login email: ${email}` : ''}`
    );
  });
}

import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SuperAdminAuthService } from '../../core/services/super-admin-auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-super-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './super-admin-layout.html',
  // Reuses the restaurant admin shell styles so both panels look and behave the same.
  styleUrl: '../../admin/layout/admin-layout.scss'
})
export class SuperAdminLayout {
  readonly auth = inject(SuperAdminAuthService);
  readonly theme = inject(ThemeService);

  logout(): void {
    this.auth.logout();
  }
}

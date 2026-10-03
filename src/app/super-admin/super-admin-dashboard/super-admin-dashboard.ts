import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuperAdminStats } from '../../core/models/super-admin.model';
import { SuperAdminService } from '../../core/services/super-admin.service';

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.scss'
})
export class SuperAdminDashboard implements OnInit {
  private readonly service = inject(SuperAdminService);

  readonly stats = signal<SuperAdminStats | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.service.stats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.error.set('Could not load the platform summary.')
    });
  }
}

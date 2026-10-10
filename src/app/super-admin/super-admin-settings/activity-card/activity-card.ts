import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminAuditLogEntry } from '../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../core/services/super-admin.service';

/** Recent changes made in this panel (refunds, password resets, plans, keys...), for a record of who did what. */
@Component({
  selector: 'app-activity-card',
  imports: [DatePipe],
  templateUrl: './activity-card.html',
  styleUrls: ['../two-factor-card/two-factor-card.scss', './activity-card.scss']
})
export class ActivityCard implements OnInit {
  private readonly service = inject(SuperAdminService);

  readonly entries = signal<AdminAuditLogEntry[] | null>(null);
  readonly failed = signal(false);
  readonly showAll = signal(false);

  ngOnInit(): void {
    this.service.auditLog(100).subscribe({
      next: (items) => this.entries.set(items),
      error: () => this.failed.set(true)
    });
  }

  /** "ApproveRefund" -> "Approve refund" */
  label(action: string): string {
    const words = action.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  outcome(status: number): 'done' | 'refused' | 'failed' {
    return status < 400 ? 'done' : status < 500 ? 'refused' : 'failed';
  }
}

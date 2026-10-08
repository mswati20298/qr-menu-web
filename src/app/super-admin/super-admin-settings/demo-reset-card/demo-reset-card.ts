import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DemoStatus } from '../../../core/models/super-admin.model';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';

/**
 * Demo deployment only (hidden elsewhere): wipe the demo back to the sample restaurant, now or every few days.
 * Plans, settings, keys and super admin logins are kept.
 */
@Component({
  selector: 'app-demo-reset-card',
  imports: [DatePipe],
  templateUrl: './demo-reset-card.html',
  styleUrl: './demo-reset-card.scss'
})
export class DemoResetCard implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly feedback = inject(FeedbackService);

  readonly status = signal<DemoStatus | null>(null);
  readonly resetting = signal(false);
  readonly savingDays = signal(false);

  readonly dayOptions = [0, 7, 15, 30, 90];

  ngOnInit(): void {
    this.service.demoStatus().subscribe({
      next: (status) => this.status.set(status),
      error: () => {
        // Not critical: the card just stays hidden.
      }
    });
  }

  setAutoReset(days: number): void {
    if (this.savingDays() || this.status()?.autoResetDays === days) {
      return;
    }
    this.savingDays.set(true);
    this.service.updateDemo(days).subscribe({
      next: (status) => {
        this.savingDays.set(false);
        this.status.set(status);
        this.feedback.success(days === 0 ? 'Auto reset turned off.' : `The demo now resets every ${days} days.`);
      },
      error: () => {
        this.savingDays.set(false);
        this.feedback.error('Could not save. Please try again.');
      }
    });
  }

  async reset(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: 'Reset the demo now?',
      message:
        'Every restaurant, order, invoice and photo on the demo is deleted, and the sample restaurant (Saket Rasoi) is created again. Plans, settings and keys are kept.',
      confirmLabel: 'Reset demo',
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.resetting.set(true);
    this.service.resetDemo().subscribe({
      next: (status) => {
        this.resetting.set(false);
        this.status.set(status);
        this.feedback.success('Demo reset. The sample restaurant is fresh again.');
      },
      error: () => {
        this.resetting.set(false);
        this.feedback.error('The reset did not finish. Please try again.');
      }
    });
  }
}

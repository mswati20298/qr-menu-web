import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { REFUND_STATUS_LABELS, REFUND_STATUS_TONE, Refund } from '../../../core/models/refund.model';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { errorMessage } from '../../../core/utils/http-error';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { RefundForm, RefundFormValue } from '../refund-form/refund-form';

type Filter = 'Requested' | '';

/** Owners' refund requests (approve or reject) and every refund made so far. */
@Component({
  selector: 'app-refund-list',
  imports: [DatePipe, FormsModule, InrPipe, RefundForm],
  templateUrl: './refund-list.html',
  styleUrl: './refund-list.scss'
})
export class RefundList implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly toast = inject(FeedbackService);

  /** Something changed: the parent reloads its totals. */
  readonly changed = output<void>();

  readonly filter = signal<Filter>('Requested');
  readonly refunds = signal<Refund[] | null>(null);
  /** "<id>:approve" or "<id>:reject" for the open form. */
  readonly openForm = signal<string | null>(null);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);
  readonly rejectNote = signal('');

  readonly labels = REFUND_STATUS_LABELS;
  readonly tone = REFUND_STATUS_TONE;

  ngOnInit(): void {
    this.load();
  }

  setFilter(filter: Filter): void {
    this.filter.set(filter);
    this.load();
  }

  open(refund: Refund, kind: 'approve' | 'reject'): void {
    this.openForm.set(`${refund.id}:${kind}`);
    this.formError.set(null);
    this.rejectNote.set('');
  }

  close(): void {
    if (!this.busy()) {
      this.openForm.set(null);
    }
  }

  approve(refund: Refund, value: RefundFormValue): void {
    this.run(this.service.approveRefund(refund.id, value.amount, value.note, value.includeFee), (done) =>
      done.status === 'Refunded' ? 'Refunded.' : 'Refund started. Razorpay will confirm it shortly.'
    );
  }

  reject(refund: Refund): void {
    const note = this.rejectNote().trim();
    if (!note) {
      this.formError.set('Tell the owner why (they will see this).');
      return;
    }
    this.run(this.service.rejectRefund(refund.id, note), () => 'Request rejected.');
  }

  private run(call: ReturnType<SuperAdminService['rejectRefund']>, message: (done: Refund) => string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    call.subscribe({
      next: (done) => {
        this.busy.set(false);
        this.openForm.set(null);
        this.toast.success(message(done));
        this.load();
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.formError.set(errorMessage(err, 'Could not do that. Please try again.'));
      }
    });
  }

  private load(): void {
    this.service.refunds(this.filter()).subscribe({
      next: (items) => this.refunds.set(items),
      error: () => {
        this.refunds.set([]);
        this.toast.error('Could not load the refunds.');
      }
    });
  }
}

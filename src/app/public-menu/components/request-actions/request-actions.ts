import { Component, inject, signal } from '@angular/core';
import { SERVICE_REQUESTS, ServiceRequestType, serviceRequestMeta } from '../../../core/models/service-request.model';
import { PublicSessionService } from '../../../core/services/public-session.service';
import { ServiceRequestService } from '../../../core/services/service-request.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { playDing } from '../../../core/tap-sound';
import { errorMessage } from '../../../core/utils/http-error';

/** How long a button shows "Sent" before it can be tapped again. Short on purpose: a repeat while the
 * first request is still open is merged by the server, so staff never get duplicates. */
const COOLDOWN_MS = 3000;

/** 🔔 Call waiter · 💧 Water · 🧾 Bill — shown to customers who scanned a table QR code. */
@Component({
  selector: 'app-request-actions',
  templateUrl: './request-actions.html',
  styleUrl: './request-actions.scss'
})
export class RequestActions {
  private readonly session = inject(PublicSessionService);
  private readonly requests = inject(ServiceRequestService);

  readonly options = SERVICE_REQUESTS;
  readonly sending = signal<ServiceRequestType | null>(null);
  readonly sent = signal<ServiceRequestType[]>([]);
  private readonly feedback = inject(FeedbackService);

  isSent(type: ServiceRequestType): boolean {
    return this.sent().includes(type);
  }

  send(type: ServiceRequestType): void {
    const table = this.session.orderTable();
    if (!table || this.sending() === type || this.isSent(type)) {
      return;
    }

    playDing();
    this.sending.set(type);

    const token = this.session.hasValidSession() ? this.session.tableSession()!.token : null;
    this.requests.send(this.session.slug(), table, type, token).subscribe({
      next: () => {
        if (this.sending() === type) {
          this.sending.set(null);
        }
        this.sent.set([...this.sent(), type]);
        this.feedback.success(serviceRequestMeta(type).sentMessage);
        setTimeout(() => this.sent.set(this.sent().filter((t) => t !== type)), COOLDOWN_MS);
      },
      error: (err) => {
        if (this.sending() === type) {
          this.sending.set(null);
        }
        if (err?.error?.code === 'table_session_expired') {
          this.session.endSession();
        }
        this.feedback.error(errorMessage(err, 'Could not send your request. Please try again or call a staff member.'));
      }
    });
  }
}

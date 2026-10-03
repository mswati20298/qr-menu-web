import { Component, inject, signal } from '@angular/core';
import { SERVICE_REQUESTS, ServiceRequestType, serviceRequestMeta } from '../../../core/models/service-request.model';
import { PublicSessionService } from '../../../core/services/public-session.service';
import { ServiceRequestService } from '../../../core/services/service-request.service';

/** How long a button stays "sent" before the customer can ask for the same thing again. */
const COOLDOWN_MS = 60000;

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
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  isSent(type: ServiceRequestType): boolean {
    return this.sent().includes(type);
  }

  send(type: ServiceRequestType): void {
    const table = this.session.tableNumber();
    if (!table || this.sending() || this.isSent(type)) {
      return;
    }

    this.sending.set(type);
    this.error.set(null);

    this.requests.send(this.session.slug(), table, type).subscribe({
      next: () => {
        this.sending.set(null);
        this.sent.set([...this.sent(), type]);
        this.message.set(serviceRequestMeta(type).sentMessage);
        setTimeout(() => this.sent.set(this.sent().filter((t) => t !== type)), COOLDOWN_MS);
      },
      error: (err) => {
        this.sending.set(null);
        this.message.set(null);
        this.error.set(err?.error?.message ?? 'Could not send your request. Please try again or call a staff member.');
      }
    });
  }
}

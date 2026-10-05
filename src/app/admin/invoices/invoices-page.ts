import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { INVOICE_PAYMENT_LABELS, Invoice, InvoiceFormat, InvoiceSummary } from '../../core/models/invoice.model';
import { StaffPaymentMethod } from '../../core/models/order.model';
import { InvoiceService } from '../../core/services/invoice.service';

@Component({
  selector: 'app-invoices-page',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './invoices-page.html',
  styleUrl: './invoices-page.scss'
})
export class InvoicesPage implements OnInit, OnDestroy {
  private readonly invoiceService = inject(InvoiceService);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = 20;
  readonly items = signal<InvoiceSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly open = signal<Invoice | null>(null);
  readonly busy = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly tableInput = signal('');
  readonly billing = signal(false);

  readonly paymentLabels = INVOICE_PAYMENT_LABELS;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  private search = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
    // /admin/invoices?open=<id> (from the Orders page) opens that invoice straight away.
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (openId) {
      this.show(openId);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(null);
  }

  onSearch(value: string): void {
    this.search = value.trim();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  goTo(page: number): void {
    if (page >= 1 && page <= this.pageCount() && page !== this.page()) {
      this.page.set(page);
      this.load();
    }
  }

  billTable(): void {
    const table = this.tableInput().trim();
    if (!table) {
      return;
    }
    this.billing.set(true);
    this.error.set(null);
    this.invoiceService.createForTable(table).subscribe({
      next: (invoice) => {
        this.billing.set(false);
        this.tableInput.set('');
        this.open.set(invoice);
        this.page.set(1);
        this.load();
      },
      error: (err) => {
        this.billing.set(false);
        this.error.set(err?.error?.errors?.[0] ?? err?.error?.message ?? 'Could not create the bill.');
      }
    });
  }

  show(id: string): void {
    this.actionError.set(null);
    this.invoiceService.get(id).subscribe({
      next: (invoice) => this.open.set(invoice),
      error: () => this.error.set('Could not open the invoice.')
    });
  }

  async print(format: InvoiceFormat): Promise<void> {
    await this.runFile(`print-${format}`, () => this.invoiceService.print(this.open()!, format));
  }

  async download(format: InvoiceFormat): Promise<void> {
    await this.runFile(`download-${format}`, () => this.invoiceService.download(this.open()!, format));
  }

  markPaid(method: StaffPaymentMethod): void {
    const invoice = this.open();
    if (!invoice) {
      return;
    }
    this.busy.set('paid');
    this.actionError.set(null);
    this.invoiceService.markPaid(invoice.id, method).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.open.set(updated);
        this.items.set(this.items().map((i) => (i.id === updated.id ? { ...i, paymentStatus: updated.paymentStatus } : i)));
      },
      error: (err) => {
        this.busy.set(null);
        this.actionError.set(err?.error?.message ?? 'Could not mark the invoice paid.');
      }
    });
  }

  cgst(invoice: Invoice): number {
    return Math.round((invoice.gstAmount / 2) * 100) / 100;
  }

  private async runFile(key: string, action: () => Promise<void>): Promise<void> {
    this.busy.set(key);
    this.actionError.set(null);
    try {
      await action();
    } catch {
      this.actionError.set('Could not get the PDF. Please try again.');
    } finally {
      this.busy.set(null);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.invoiceService.list(this.search, this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load invoices.');
      }
    });
  }
}

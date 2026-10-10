import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { REPORT_RANGES, ReportRange } from '../../../core/services/report-export.util';

/**
 * Period picker + Export button, the same on Orders and Invoices. The parent does the download.
 * The picker is our own small menu (not a native <select>), so its list follows the panel theme too.
 */
@Component({
  selector: 'app-report-export',
  templateUrl: './report-export.html',
  styleUrl: './report-export.scss'
})
export class ReportExport {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input('Export');
  readonly busy = input(false);
  readonly exportRange = output<ReportRange>();

  readonly ranges = REPORT_RANGES;
  readonly range = signal<ReportRange>('today');
  readonly open = signal(false);
  readonly rangeLabel = computed(() => this.ranges.find((r) => r.value === this.range())?.label ?? '');

  choose(value: ReportRange): void {
    this.range.set(value);
    this.open.set(false);
  }

  /** Arrow keys move through the options while the list is open; Escape closes it. */
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const i = this.ranges.findIndex((r) => r.value === this.range());
    const next = event.key === 'ArrowDown' ? Math.min(i + 1, this.ranges.length - 1) : Math.max(i - 1, 0);
    this.range.set(this.ranges[next].value);
    this.open.set(true);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

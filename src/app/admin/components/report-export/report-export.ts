import { Component, input, output, signal } from '@angular/core';
import { REPORT_RANGES, ReportRange } from '../../../core/services/report-export.util';

/** Period picker + Export button, the same on Orders and Invoices. The parent does the download. */
@Component({
  selector: 'app-report-export',
  templateUrl: './report-export.html',
  styleUrl: './report-export.scss'
})
export class ReportExport {
  readonly label = input('Export');
  readonly busy = input(false);
  readonly exportRange = output<ReportRange>();

  readonly ranges = REPORT_RANGES;
  readonly range = signal<ReportRange>('today');
}

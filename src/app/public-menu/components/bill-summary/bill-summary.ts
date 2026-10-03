import { Component, input, output } from '@angular/core';
import { BillBreakup } from '../../../core/services/billing.util';

@Component({
  selector: 'app-bill-summary',
  templateUrl: './bill-summary.html',
  styleUrl: './bill-summary.scss'
})
export class BillSummary {
  readonly bill = input.required<BillBreakup>();
  readonly gstPercentage = input<number>(0);
  readonly serviceChargePercentage = input<number>(0);
  /** When true and service charge is normally enabled, shows a Remove/Add toggle link
   * (customer-initiated opt-out) instead of a plain read-only line. */
  readonly serviceChargeEnabled = input(false);
  readonly serviceChargeRemoved = input(false);
  readonly toggleServiceCharge = output<void>();
}

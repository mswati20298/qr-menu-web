import { Component, computed, input } from '@angular/core';

export type PillStatus =
  | 'Placed'
  | 'Preparing'
  | 'Served'
  | 'Completed'
  | 'Cancelled'
  | 'Available'
  | 'Occupied'
  | 'Disabled'
  | 'BillRequested';

interface PillStyle {
  label: string;
  bgVar: string;
  textVar: string;
}

const STYLES: Record<PillStatus, PillStyle> = {
  Placed: { label: 'New', bgVar: '--admin-info-soft', textVar: '--admin-info-text' },
  Preparing: { label: 'Preparing', bgVar: '--admin-warning-soft', textVar: '--admin-warning-text' },
  Served: { label: 'Served', bgVar: '--admin-success-soft', textVar: '--admin-success-text' },
  Completed: { label: 'Completed', bgVar: '--admin-completed-soft', textVar: '--admin-completed-text' },
  Cancelled: { label: 'Cancelled', bgVar: '--admin-danger-soft', textVar: '--admin-danger-text' },
  Available: { label: 'Available', bgVar: '--admin-success-soft', textVar: '--admin-success-text' },
  Occupied: { label: 'Occupied', bgVar: '--admin-warning-soft', textVar: '--admin-warning-text' },
  Disabled: { label: 'Disabled', bgVar: '--admin-completed-soft', textVar: '--admin-completed-text' },
  BillRequested: { label: 'Bill requested', bgVar: '--admin-status-bill-soft', textVar: '--admin-status-bill-text' }
};

@Component({
  selector: 'app-status-pill',
  template: `
    <span class="status-pill" [style.background]="style().bg" [style.color]="style().text">
      {{ label() ?? style().label }}
    </span>
  `,
  styles: [
    `
      .status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
      }
    `
  ]
})
export class StatusPill {
  readonly status = input.required<PillStatus>();
  readonly label = input<string | null>(null);

  readonly style = computed(() => {
    const def = STYLES[this.status()];
    return {
      label: def.label,
      bg: `var(${def.bgVar})`,
      text: `var(${def.textVar})`
    };
  });
}

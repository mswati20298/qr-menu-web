import { Pipe, PipeTransform } from '@angular/core';

/** Rounds to the nearest rupee and applies Indian digit grouping — the single
 * currency format used across the admin dashboard so amounts read consistently. */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '₹0';
    }
    return '₹' + Math.round(value).toLocaleString('en-IN');
  }
}

import { Component, HostListener, input, output } from '@angular/core';
import { PublicRestaurant } from '../../../core/models/public-menu.model';

@Component({
  selector: 'app-help-sheet',
  templateUrl: './help-sheet.html',
  styleUrl: './help-sheet.scss'
})
export class HelpSheet {
  readonly restaurant = input.required<PublicRestaurant>();

  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  get callHref(): string {
    return `tel:${this.restaurant().whatsAppNumber}`;
  }

  get whatsAppHref(): string {
    const phone = this.restaurant().whatsAppNumber.replace(/[^0-9]/g, '');
    return `https://wa.me/${phone}`;
  }

  formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }
}

import { Component, input, output } from '@angular/core';
import { PublicCategory } from '../../../core/models/public-menu.model';

@Component({
  selector: 'app-category-pills',
  templateUrl: './category-pills.html',
  styleUrl: './category-pills.scss'
})
export class CategoryPills {
  readonly categories = input.required<PublicCategory[]>();
  readonly activeCategoryId = input<string | null>(null);

  readonly select = output<string | null>();
}

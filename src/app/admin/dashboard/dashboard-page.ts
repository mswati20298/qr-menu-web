import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardStats } from '../../core/models/restaurant.model';
import { RestaurantTable } from '../../core/models/table.model';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TableService } from '../../core/services/table.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { PillStatus, StatusPill } from '../components/status-pill/status-pill';

type ChartRange = 'today' | '7d' | '30d';

interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
  date: string;
  revenue: number;
  isZero: boolean;
}

interface ChartTick {
  y: number;
  label: string;
}

interface Comparison {
  arrow: string;
  cls: 'up' | 'down' | 'flat';
  text: string;
}

const CHART_MARGIN_LEFT = 48;
const CHART_MARGIN_TOP = 22;
const CHART_WIDTH = 580;
const CHART_HEIGHT = 128;
const CHART_VIEW_WIDTH = CHART_MARGIN_LEFT + CHART_WIDTH + 10;
const CHART_VIEW_HEIGHT = CHART_MARGIN_TOP + CHART_HEIGHT + 10;
const CHART_MIN_BAR_HEIGHT = 3;

@Component({
  selector: 'app-dashboard-page',
  imports: [InrPipe, StatusPill],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss'
})
export class DashboardPage implements OnInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly tableService = inject(TableService);
  private readonly router = inject(Router);
  readonly notifications = inject(OrderNotificationService);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly chartRange = signal<ChartRange>('7d');

  readonly tableDots = computed(() =>
    this.tables()
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        number: t.number,
        status: !t.isActive ? 'Disabled' : t.hasActiveOrder ? 'Occupied' : 'Available'
      }))
  );

  readonly chartData = computed<{ date: string; revenue: number }[]>(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }
    if (this.chartRange() === 'today') {
      return [{ date: new Date().toISOString().slice(0, 10), revenue: s.totalRevenueToday }];
    }
    if (this.chartRange() === '30d') {
      return s.revenueLast30Days;
    }
    return s.revenueLast7Days;
  });

  readonly chartMax = computed(() => Math.max(1, ...this.chartData().map((d) => d.revenue)));

  readonly chartViewBox = `0 0 ${CHART_VIEW_WIDTH} ${CHART_VIEW_HEIGHT}`;
  readonly chartAxisX = CHART_MARGIN_LEFT;
  readonly chartAxisY = CHART_MARGIN_TOP + CHART_HEIGHT;
  readonly chartAxisX2 = CHART_MARGIN_LEFT + CHART_WIDTH;

  readonly chartTicks = computed<ChartTick[]>(() => {
    const max = this.chartMax();
    return [1, 0.5, 0].map((fraction) => ({
      y: CHART_MARGIN_TOP + CHART_HEIGHT * (1 - fraction),
      label: this.formatCompactInr(max * fraction)
    }));
  });

  readonly chartBars = computed<ChartBar[]>(() => {
    const data = this.chartData();
    if (data.length === 0) {
      return [];
    }
    const max = this.chartMax();
    const slot = CHART_WIDTH / data.length;
    const barWidth = Math.max(4, Math.min(44, slot - 6));

    return data.map((d, i) => {
      const rawHeight = (d.revenue / max) * CHART_HEIGHT;
      const height = d.revenue > 0 ? Math.max(rawHeight, CHART_MIN_BAR_HEIGHT) : CHART_MIN_BAR_HEIGHT;
      return {
        x: CHART_MARGIN_LEFT + i * slot + (slot - barWidth) / 2,
        y: CHART_MARGIN_TOP + CHART_HEIGHT - height,
        width: barWidth,
        height,
        date: d.date,
        revenue: d.revenue,
        isZero: d.revenue <= 0
      };
    });
  });

  readonly showChartLabels = computed(() => this.chartData().length <= 7);

  formatCompactInr(value: number): string {
    if (value >= 1000) {
      return '₹' + (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + 'k';
    }
    return '₹' + Math.round(value);
  }

  ngOnInit(): void {
    this.restaurantService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.tableService.getAll().subscribe({
      next: (tables) => this.tables.set(tables),
      error: () => {
        // Table dots just stay empty — not critical to the dashboard's core stats.
      }
    });
  }

  formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  pillStatus(status: string): PillStatus {
    return status as PillStatus;
  }

  recentTableLabel(tableNumber: string | null): string {
    return tableNumber ? `Table ${tableNumber}` : 'Takeaway';
  }

  firstItemLabel(summary: string): string {
    const parts = summary.split(', ').filter(Boolean);
    if (parts.length <= 1) {
      return summary || '—';
    }
    return `${parts[0]} +${parts.length - 1} more`;
  }

  comparison(today: number, yesterday: number): Comparison {
    if (yesterday <= 0) {
      return today > 0
        ? { arrow: '↑', cls: 'up', text: 'vs ₹0 yesterday' }
        : { arrow: '→', cls: 'flat', text: 'No data yesterday' };
    }
    const pct = ((today - yesterday) / yesterday) * 100;
    if (pct > 1) {
      return { arrow: '↑', cls: 'up', text: `${pct.toFixed(0)}% vs yesterday` };
    }
    if (pct < -1) {
      return { arrow: '↓', cls: 'down', text: `${Math.abs(pct).toFixed(0)}% vs yesterday` };
    }
    return { arrow: '→', cls: 'flat', text: 'Same as yesterday' };
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }
}

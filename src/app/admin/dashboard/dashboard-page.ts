import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardStats } from '../../core/models/restaurant.model';
import { RestaurantTable } from '../../core/models/table.model';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { TableService } from '../../core/services/table.service';
import { UploadService } from '../../core/services/upload.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { PillStatus, StatusPill } from '../components/status-pill/status-pill';

type ChartRange = 'today' | '7d' | '30d';

interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
  key: string;
  label: string;
  revenue: number;
  orders: number;
  isZero: boolean;
}

interface Delta {
  cls: 'up' | 'down' | 'flat';
  text: string;
}

interface Spark {
  line: string;
  area: string;
}

const CHART_LEFT = 48;
const CHART_TOP = 26;
const CHART_W = 580;
const CHART_H = 150;
const SPARK_W = 96;
const SPARK_H = 34;

@Component({
  selector: 'app-dashboard-page',
  imports: [InrPipe, StatusPill],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss'
})
export class DashboardPage implements OnInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly tableService = inject(TableService);
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);
  readonly notifications = inject(OrderNotificationService);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly chartRange = signal<ChartRange>('today');

  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  /** Orders still waiting for the kitchen or the table: what needs the owner's attention. */
  readonly waiting = computed(() => this.notifications.activeOrderCount());

  readonly occupiedTables = computed(() => this.tables().filter((t) => t.isActive && t.hasActiveOrder));

  readonly tableDots = computed(() =>
    this.tables()
      .filter((t) => t.isActive)
      .slice(0, 12)
      .map((t) => ({ id: t.id, number: t.number, occupied: t.hasActiveOrder }))
  );

  readonly topItem = computed(() => this.stats()?.topSellingItems[0] ?? null);

  // --- KPI sparklines (last 7 days) ---
  readonly ordersSpark = computed(() => this.spark(this.stats()?.revenueLast7Days.map((d) => d.orderCount) ?? []));
  readonly revenueSpark = computed(() => this.spark(this.stats()?.revenueLast7Days.map((d) => d.revenue) ?? []));
  readonly avgSpark = computed(() =>
    this.spark(this.stats()?.revenueLast7Days.map((d) => (d.orderCount > 0 ? d.revenue / d.orderCount : 0)) ?? [])
  );

  // --- Sales chart ---
  readonly chartViewBox = `0 0 ${CHART_LEFT + CHART_W + 10} ${CHART_TOP + CHART_H + 30}`;
  readonly axisLabelY = CHART_TOP + CHART_H + 20;
  readonly axisX = CHART_LEFT;
  readonly axisX2 = CHART_LEFT + CHART_W;

  /** Today: one bar per hour from the first sale (or 9 AM) to now. Otherwise one bar per day. */
  private readonly chartData = computed<{ key: string; label: string; revenue: number; orders: number }[]>(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }
    if (this.chartRange() === 'today') {
      const hours = s.revenueTodayByHour ?? [];
      const nowHour = new Date().getHours();
      const firstSale = hours.find((h) => h.revenue > 0)?.hour ?? 9;
      const from = Math.min(firstSale, nowHour, 9);
      return hours
        .filter((h) => h.hour >= from && h.hour <= Math.max(nowHour, from))
        .map((h) => ({ key: `h${h.hour}`, label: this.hourLabel(h.hour), revenue: h.revenue, orders: h.orderCount }));
    }
    const days = this.chartRange() === '30d' ? s.revenueLast30Days : s.revenueLast7Days;
    return days.map((d) => ({ key: d.date, label: this.shortDate(d.date), revenue: d.revenue, orders: d.orderCount }));
  });

  readonly chartTotal = computed(() => this.chartData().reduce((sum, d) => sum + d.revenue, 0));
  readonly chartHasSales = computed(() => this.chartTotal() > 0);
  /** Top of the scale, rounded up to a clean number (₹1k when there are no sales yet). */
  private readonly chartMax = computed(() => {
    const max = Math.max(0, ...this.chartData().map((d) => d.revenue));
    if (max <= 0) {
      return 1000;
    }
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((v) => v >= max) ?? max;
  });

  readonly chartTicks = computed(() =>
    [1, 0.5, 0].map((f) => ({ y: CHART_TOP + CHART_H * (1 - f), label: this.compactInr(this.chartMax() * f) }))
  );

  readonly chartBars = computed<ChartBar[]>(() => {
    const data = this.chartData();
    if (data.length === 0) {
      return [];
    }
    const slot = CHART_W / data.length;
    const width = Math.max(5, Math.min(42, slot - 8));
    return data.map((d, i) => {
      const height = d.revenue > 0 ? Math.max((d.revenue / this.chartMax()) * CHART_H, 4) : 3;
      return {
        x: CHART_LEFT + i * slot + (slot - width) / 2,
        y: CHART_TOP + CHART_H - height,
        width,
        height,
        key: d.key,
        label: d.label,
        revenue: d.revenue,
        orders: d.orders,
        isZero: d.revenue <= 0
      };
    });
  });

  /** Every bar's label when they fit, otherwise every few. */
  readonly labelEvery = computed(() => Math.ceil(this.chartBars().length / 10));

  readonly bestBar = computed(() => {
    const bars = this.chartBars().filter((b) => !b.isZero);
    return bars.length ? bars.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;
  });

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
        // Table dots just stay empty — not critical to the dashboard.
      }
    });
  }

  /** "+2 vs yesterday", "+₹570 vs yesterday", or a plain message when there is nothing to compare. */
  delta(today: number, yesterday: number, money: boolean): Delta {
    const diff = Math.round(today - yesterday);
    if (today === 0 && yesterday === 0) {
      return { cls: 'flat', text: 'Nothing yet today' };
    }
    if (diff === 0) {
      return { cls: 'flat', text: 'Same as yesterday' };
    }
    const amount = money ? '₹' + Math.abs(diff).toLocaleString('en-IN') : String(Math.abs(diff));
    return diff > 0 ? { cls: 'up', text: `+${amount} vs yesterday` } : { cls: 'down', text: `−${amount} vs yesterday` };
  }

  imageUrl(url: string | null | undefined): string | null {
    return this.uploadService.thumbUrl(url, 160);
  }

  initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  pillStatus(status: string): PillStatus {
    return status as PillStatus;
  }

  tableLabel(tableNumber: string | null): string {
    return tableNumber ? `Table ${tableNumber}` : 'Takeaway';
  }

  itemsLabel(summary: string): string {
    const parts = summary.split(', ').filter(Boolean);
    return parts.length <= 1 ? summary || '—' : `${parts[0]} +${parts.length - 1} more`;
  }

  timeAgo(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso.endsWith('Z') ? iso : iso + 'Z')) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  compactInr(value: number): string {
    if (value >= 100000) return '₹' + (value / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (value >= 1000) return '₹' + (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + Math.round(value);
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  private hourLabel(hour: number): string {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}${hour < 12 ? 'am' : 'pm'}`;
  }

  private shortDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  private spark(values: number[]): Spark | null {
    if (values.length < 2 || values.every((v) => v === 0)) {
      return null;
    }
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * SPARK_W;
      const y = SPARK_H - 3 - ((v - min) / range) * (SPARK_H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { line: `M${points.join(' L')}`, area: `M0,${SPARK_H} L${points.join(' L')} L${SPARK_W},${SPARK_H} Z` };
  }
}

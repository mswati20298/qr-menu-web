import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SuperAdminStats } from '../../core/models/super-admin.model';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { UploadService } from '../../core/services/upload.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';

type ChartRange = '30d' | '12m';

interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
  key: string;
  label: string;
  revenue: number;
  payments: number;
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

/**
 * The platform owner's dashboard: money received for plans first, then restaurants, renewals and activity.
 * Same look as the restaurant dashboard (it reuses that stylesheet).
 */
@Component({
  selector: 'app-super-admin-dashboard',
  imports: [InrPipe],
  templateUrl: './super-admin-dashboard.html',
  styleUrls: ['../../admin/dashboard/dashboard-page.scss', './super-admin-dashboard.scss']
})
export class SuperAdminDashboard implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);

  readonly stats = signal<SuperAdminStats | null>(null);
  readonly error = signal<string | null>(null);
  readonly chartRange = signal<ChartRange>('30d');

  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  private readonly last7 = computed(() => this.stats()?.last30Days.slice(-7) ?? []);

  readonly revenueSpark = computed(() => this.spark(this.last7().map((d) => d.revenue)));
  readonly monthSpark = computed(() => this.spark(this.stats()?.last12Months.slice(-6).map((m) => m.revenue) ?? []));
  readonly signupSpark = computed(() => this.spark(this.stats()?.last30Days.map((d) => d.newRestaurants) ?? []));
  readonly ordersSpark = computed(() => this.spark(this.last7().map((d) => d.orders)));

  /** Plan mix as tiles, each linking to the filtered restaurant list. */
  readonly planTiles = computed(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }
    return [
      { key: 'paid', label: 'Paying', value: s.paidPlans, tone: 'success' },
      { key: 'trial', label: 'On free trial', value: s.onTrial, tone: 'info' },
      { key: 'expiring', label: 'Ending in 7 days', value: s.expiringSoon, tone: 'warning' },
      { key: 'grace', label: 'In grace period', value: s.inGrace, tone: 'warning' },
      { key: 'stopped', label: 'Ordering stopped', value: s.orderingStopped, tone: 'danger' }
    ];
  });

  // --- Revenue chart ---
  readonly chartViewBox = `0 0 ${CHART_LEFT + CHART_W + 10} ${CHART_TOP + CHART_H + 30}`;
  readonly axisLabelY = CHART_TOP + CHART_H + 20;
  readonly axisX = CHART_LEFT;
  readonly axisX2 = CHART_LEFT + CHART_W;

  private readonly chartData = computed(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }
    if (this.chartRange() === '12m') {
      return s.last12Months.map((m) => ({ key: m.month, label: this.monthLabel(m.month), revenue: m.revenue, payments: m.payments }));
    }
    return s.last30Days.map((d) => ({ key: d.date, label: this.shortDate(d.date), revenue: d.revenue, payments: d.payments }));
  });

  readonly chartTotal = computed(() => this.chartData().reduce((sum, d) => sum + d.revenue, 0));
  readonly chartHasSales = computed(() => this.chartTotal() > 0);

  /** Top of the scale, rounded up to a clean number (₹1k when nothing came in yet). */
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
        payments: d.payments,
        isZero: d.revenue <= 0
      };
    });
  });

  readonly labelEvery = computed(() => Math.ceil(this.chartBars().length / 10));

  readonly bestBar = computed(() => {
    const bars = this.chartBars().filter((b) => !b.isZero);
    return bars.length ? bars.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;
  });

  ngOnInit(): void {
    this.service.stats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.error.set('Could not load the platform summary.')
    });
  }

  /** "+₹999 vs yesterday", or a plain message when there is nothing to compare. */
  delta(now: number, before: number, money: boolean, versus: string): Delta {
    const diff = Math.round(now - before);
    if (now === 0 && before === 0) {
      return { cls: 'flat', text: `Nothing yet` };
    }
    if (diff === 0) {
      return { cls: 'flat', text: `Same as ${versus}` };
    }
    const amount = money ? '₹' + Math.abs(diff).toLocaleString('en-IN') : String(Math.abs(diff));
    return diff > 0 ? { cls: 'up', text: `+${amount} vs ${versus}` } : { cls: 'down', text: `−${amount} vs ${versus}` };
  }

  imageUrl(url: string | null | undefined): string | null {
    return this.uploadService.resolveUrl(url ?? null);
  }

  initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  methodLabel(method: string | null): string {
    switch (method) {
      case 'Online':
        return 'Razorpay';
      case 'Upi':
        return 'UPI';
      case 'BankTransfer':
        return 'Bank';
      case null:
        return '—';
      default:
        return method;
    }
  }

  planLabel(plan: string): string {
    return plan === 'Paid' ? 'Paid' : plan === 'Trial' ? 'Trial' : plan === 'Free' ? 'Free' : plan;
  }

  timeAgo(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso.endsWith('Z') ? iso : iso + 'Z')) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  /** "in 3 days", "tomorrow", "today". */
  endsIn(iso: string): string {
    const days = Math.ceil((Date.parse(iso.endsWith('Z') ? iso : iso + 'Z') - Date.now()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  }

  compactInr(value: number): string {
    if (value >= 100000) return '₹' + (value / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (value >= 1000) return '₹' + (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + Math.round(value);
  }

  goTo(path: string, plan?: string): void {
    this.router.navigate([path], plan ? { queryParams: { plan } } : {});
  }

  private shortDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  private monthLabel(month: string): string {
    return new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' });
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

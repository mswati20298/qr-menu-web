import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KitchenOrder, KitchenStatus } from '../../core/models/kitchen.model';
import { AuthService } from '../../core/services/auth.service';
import { KitchenAuthService } from '../../core/services/kitchen-auth.service';
import { KitchenService } from '../../core/services/kitchen.service';
import { errorMessage } from '../../core/utils/http-error';
import { AppIcon } from '../../shared/app-icon/app-icon';

const POLL_MS = 5000;
const TICK_MS = 15000;
const UNDO_MS = 5000;
const NEW_HIGHLIGHT_MS = 60000;
const LATE_AMBER_MIN = 10;
const LATE_RED_MIN = 20;
const SOUND_KEY = 'qrmenu_kitchen_sound';

interface Column {
  status: KitchenStatus;
  label: string;
  action: string;
}

const COLUMNS: Column[] = [
  { status: 'Placed', label: 'New', action: 'Tap to start cooking' },
  { status: 'Preparing', label: 'Preparing', action: 'Tap when ready' },
  { status: 'Served', label: 'Served', action: '' }
];

interface WakeLockLike {
  release(): Promise<void>;
}

/**
 * Full-screen kitchen display. Polls the kitchen API, chimes for new orders and moves an order one step on
 * each tap (New → Preparing → Served), with a few seconds to undo a mis-tap.
 */
@Component({
  selector: 'app-kitchen-board',
  imports: [AppIcon],
  templateUrl: './kitchen-board.html',
  styleUrl: './kitchen-board.scss'
})
export class KitchenBoard implements OnInit, OnDestroy {
  private readonly kitchen = inject(KitchenService);
  private readonly kitchenAuth = inject(KitchenAuthService);
  private readonly ownerAuth = inject(AuthService);
  private readonly router = inject(Router);

  readonly columns = COLUMNS;
  readonly restaurantName = signal('Kitchen');
  readonly orders = signal<KitchenOrder[]>([]);
  readonly loaded = signal(false);
  readonly offline = signal(false);
  readonly busyIds = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);
  readonly undo = signal<{ order: KitchenOrder; to: KitchenStatus } | null>(null);
  readonly soundOn = signal(this.readSoundSetting());
  readonly audioReady = signal(false);
  readonly isFullscreen = signal(false);
  readonly now = signal(Date.now());

  /** Signed in with the kitchen PIN (rather than as the owner). */
  readonly isKitchenSession = computed(() => this.kitchenAuth.isAuthenticated());

  private readonly newIds = signal<Map<string, number>>(new Map());
  private knownIds: Set<string> | null = null;
  /** server clock − device clock, so "12 min ago" is right even if the tablet's clock is off. */
  private clockOffset = 0;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private undoHandle: ReturnType<typeof setTimeout> | null = null;
  private audio: AudioContext | null = null;
  private wakeLock: WakeLockLike | null = null;

  readonly byStatus = computed(() => {
    const groups: Record<KitchenStatus, KitchenOrder[]> = { Placed: [], Preparing: [], Served: [] };
    for (const order of this.orders()) {
      groups[order.status]?.push(order);
    }
    // Served: most recent first; the others oldest first (cook in order).
    groups.Served.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return groups;
  });

  readonly clock = computed(() =>
    new Date(this.now()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  );

  ngOnInit(): void {
    this.load();
    this.pollHandle = setInterval(() => this.load(), POLL_MS);
    this.tickHandle = setInterval(() => this.now.set(Date.now()), TICK_MS);
    void this.keepScreenOn();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (this.tickHandle) clearInterval(this.tickHandle);
    if (this.undoHandle) clearTimeout(this.undoHandle);
    void this.wakeLock?.release().catch(() => undefined);
    void this.audio?.close().catch(() => undefined);
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  // The screen lock is dropped when the tab is hidden; take it again when it comes back.
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.keepScreenOn();
      this.load();
    }
  }

  /** Browsers only allow sound after a tap, so the first tap anywhere switches it on. */
  @HostListener('document:pointerdown')
  unlockAudio(): void {
    if (this.audioReady()) {
      return;
    }
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      this.audioReady.set(true);
    } catch {
      // No Web Audio: stay silent.
    }
  }

  tap(order: KitchenOrder): void {
    if (order.status === 'Served' || this.busyIds().has(order.id)) {
      return;
    }
    const to: KitchenStatus = order.status === 'Placed' ? 'Preparing' : 'Served';
    this.setBusy(order.id, true);
    this.error.set(null);
    this.replace({ ...order, status: to, updatedAt: new Date(Date.now() + this.clockOffset).toISOString() });
    this.clearNew(order.id);

    this.kitchen.advance(order.id).subscribe({
      next: (updated) => {
        this.setBusy(order.id, false);
        this.replace(updated);
        this.showUndo(updated, order.status);
      },
      error: (err) => {
        this.setBusy(order.id, false);
        this.replace(order);
        this.error.set(errorMessage(err, 'Could not update the order. Check the connection.'));
      }
    });
  }

  undoLast(): void {
    const pending = this.undo();
    if (!pending) {
      return;
    }
    this.hideUndo();
    this.replace({ ...pending.order, status: pending.to });
    this.kitchen.revert(pending.order.id).subscribe({
      next: (updated) => this.replace(updated),
      error: (err) => {
        this.error.set(errorMessage(err, 'Could not undo.'));
        this.load();
      }
    });
  }

  toggleSound(): void {
    const on = !this.soundOn();
    this.soundOn.set(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
    if (on) {
      this.unlockAudio();
      this.chime();
    }
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Not allowed (e.g. iOS Safari): ignore.
    }
  }

  signOut(): void {
    if (this.isKitchenSession()) {
      this.kitchenAuth.logout();
      this.router.navigate(['/kitchen/login']);
    } else {
      this.router.navigate(['/admin/orders']);
    }
  }

  isNew(id: string): boolean {
    const since = this.newIds().get(id);
    return since !== undefined && this.now() - since < NEW_HIGHLIGHT_MS;
  }

  isBusy(id: string): boolean {
    return this.busyIds().has(id);
  }

  minutesSince(iso: string): number {
    return Math.max(0, Math.floor((this.now() + this.clockOffset - new Date(iso).getTime()) / 60000));
  }

  elapsedLabel(order: KitchenOrder): string {
    const minutes = this.minutesSince(order.status === 'Served' ? order.updatedAt : order.createdAt);
    if (order.status === 'Served') {
      return minutes < 1 ? 'served just now' : `served ${minutes} min ago`;
    }
    return minutes < 1 ? 'just now' : `${minutes} min`;
  }

  urgency(order: KitchenOrder): 'normal' | 'amber' | 'red' {
    if (order.status === 'Served') {
      return 'normal';
    }
    const minutes = this.minutesSince(order.createdAt);
    return minutes >= LATE_RED_MIN ? 'red' : minutes >= LATE_AMBER_MIN ? 'amber' : 'normal';
  }

  itemCount(order: KitchenOrder): number {
    return order.items.reduce((sum, item) => sum + item.qty, 0);
  }

  private load(): void {
    this.kitchen.board().subscribe({
      next: (board) => {
        this.offline.set(false);
        this.restaurantName.set(board.restaurantName);
        this.clockOffset = new Date(board.serverTime).getTime() - Date.now();

        // Keep local changes for orders whose tap is still being saved.
        const busy = this.busyIds();
        const current = new Map(this.orders().map((o) => [o.id, o]));
        this.orders.set(board.orders.map((o) => (busy.has(o.id) ? current.get(o.id) ?? o : o)));

        this.detectNewOrders(board.orders);
        this.loaded.set(true);
      },
      // 401/403 are handled by the error interceptor (back to the kitchen login).
      error: () => {
        this.offline.set(true);
        this.loaded.set(true);
      }
    });
  }

  private detectNewOrders(orders: KitchenOrder[]): void {
    const placed = orders.filter((o) => o.status === 'Placed');
    if (this.knownIds === null) {
      // First load: nothing is "new" yet.
      this.knownIds = new Set(orders.map((o) => o.id));
      return;
    }

    const fresh = placed.filter((o) => !this.knownIds!.has(o.id));
    orders.forEach((o) => this.knownIds!.add(o.id));
    if (fresh.length === 0) {
      return;
    }

    const map = new Map(this.newIds());
    fresh.forEach((o) => map.set(o.id, Date.now()));
    this.newIds.set(map);
    this.chime();
  }

  private clearNew(id: string): void {
    if (this.newIds().has(id)) {
      const map = new Map(this.newIds());
      map.delete(id);
      this.newIds.set(map);
    }
  }

  private replace(order: KitchenOrder): void {
    this.orders.set(this.orders().map((o) => (o.id === order.id ? order : o)));
  }

  private setBusy(id: string, busy: boolean): void {
    const next = new Set(this.busyIds());
    if (busy) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.busyIds.set(next);
  }

  private showUndo(order: KitchenOrder, to: KitchenStatus): void {
    if (this.undoHandle) clearTimeout(this.undoHandle);
    this.undo.set({ order, to });
    this.undoHandle = setTimeout(() => this.hideUndo(), UNDO_MS);
  }

  private hideUndo(): void {
    if (this.undoHandle) clearTimeout(this.undoHandle);
    this.undoHandle = null;
    this.undo.set(null);
  }

  /** Three rising beeps, loud enough for a busy kitchen. Silent until the screen has been tapped once. */
  private chime(): void {
    if (!this.soundOn() || !this.audio) {
      return;
    }
    try {
      const ctx = this.audio;
      const start = ctx.currentTime;
      [880, 1108.73, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = start + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.32);
      });
    } catch {
      // ignore
    }
  }

  /** Stops the tablet from dimming and locking while the kitchen screen is open. */
  private async keepScreenOn(): Promise<void> {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } };
    try {
      this.wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not supported or not allowed: the screen may dim.
    }
  }

  private readSoundSetting(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  }
}

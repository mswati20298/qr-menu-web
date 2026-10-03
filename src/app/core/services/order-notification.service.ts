import { Injectable, signal } from '@angular/core';
import { Order } from '../models/order.model';
import { ServiceRequest, serviceRequestMeta } from '../models/service-request.model';
import { OrderService } from './order.service';
import { ServiceRequestService } from './service-request.service';

export interface OrderToast {
  id: string;
  kind: 'order' | 'request';
  /** Emoji for service requests; orders use the receipt icon. */
  icon: string | null;
  message: string;
  /** Order total (orders only). */
  amount: number | null;
}

const POLL_INTERVAL_MS = 15000;
/** Waiter calls are time-sensitive, so they are checked more often than orders. */
const REQUEST_POLL_INTERVAL_MS = 8000;
const NEW_FLAG_DURATION_MS = 10000;

@Injectable({ providedIn: 'root' })
export class OrderNotificationService {
  private lastCheckedAt = new Date();
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private requestPollHandle: ReturnType<typeof setInterval> | null = null;
  private knownRequestIds = new Set<string>();
  private requestsLoaded = false;
  private toastCounter = 0;
  private audioContext: AudioContext | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private readonly unlockEvents = ['click', 'keydown', 'touchstart'] as const;
  private readonly unlockAudioHandler = () => this.unlockAudio();

  readonly unreadCount = signal(0);
  readonly toasts = signal<OrderToast[]>([]);
  /** Ids of orders that arrived in the last ~10s — drives a brief highlight animation
   * wherever the order is shown. Self-expiring, so callers never need to clear it. */
  readonly newOrderIds = signal<Set<string>>(new Set());
  /** Orders not yet Served/Completed/Cancelled — drives the sidebar "Orders" badge. */
  readonly activeOrderCount = signal(0);
  /** Waiter / water / bill requests nobody has handled yet — drives the sidebar "Requests" badge. */
  readonly pendingRequests = signal<ServiceRequest[]>([]);

  constructor(
    private readonly orderService: OrderService,
    private readonly requestService: ServiceRequestService
  ) {}

  start(): void {
    if (this.pollHandle) {
      return;
    }
    this.lastCheckedAt = new Date();
    this.registerAudioUnlock();
    this.refreshActiveCount();
    this.refreshRequests();
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.requestPollHandle = setInterval(() => this.refreshRequests(), REQUEST_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.requestPollHandle) {
      clearInterval(this.requestPollHandle);
      this.requestPollHandle = null;
    }
    this.requestsLoaded = false;
    this.unlockEvents.forEach((e) => window.removeEventListener(e, this.unlockAudioHandler));
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  markAllRead(): void {
    this.unreadCount.set(0);
  }

  dismissToast(id: string): void {
    this.toasts.set(this.toasts().filter((t) => t.id !== id));
  }

  private poll(): void {
    const checkedFrom = this.lastCheckedAt;
    this.lastCheckedAt = new Date();

    this.orderService.getNewOrdersSince(checkedFrom).subscribe({
      next: (orders) => {
        if (orders.length === 0) {
          return;
        }
        this.unreadCount.set(this.unreadCount() + orders.length);
        this.newOrderIds.set(new Set([...this.newOrderIds(), ...orders.map((o) => o.id)]));
        orders.forEach((order) => {
          this.pushToast(order);
          const id = order.id;
          setTimeout(() => {
            const current = new Set(this.newOrderIds());
            current.delete(id);
            this.newOrderIds.set(current);
          }, NEW_FLAG_DURATION_MS);
        });
        this.announce(orders);
        this.refreshActiveCount();
      },
      error: () => {
        // Silently ignore — next poll cycle will retry. A transient network
        // blip shouldn't surface as an error toast on top of order toasts.
      }
    });
  }

  /** Called after actions that change order status elsewhere in the app, so the
   * sidebar badge doesn't wait for the next poll tick. */
  refreshActiveCount(): void {
    this.orderService.getAllForOwner().subscribe({
      next: (orders) => {
        const active = orders.filter((o) => o.status === 'Placed' || o.status === 'Preparing').length;
        this.activeOrderCount.set(active);
      },
      error: () => {
        // Silently ignore — badge just keeps its last known value.
      }
    });
  }

  /** Loads pending service requests. Anything that appeared since the last check gets the
   * ding + voice + toast. The very first load is silent, so reopening the admin panel
   * doesn't re-announce requests that were already waiting. */
  refreshRequests(): void {
    this.requestService.listPending().subscribe({
      next: (requests) => {
        const fresh = this.requestsLoaded ? requests.filter((r) => !this.knownRequestIds.has(r.id)) : [];
        this.requestsLoaded = true;
        this.knownRequestIds = new Set(requests.map((r) => r.id));
        this.pendingRequests.set(requests);
        if (fresh.length > 0) {
          this.announceRequests(fresh);
        }
      },
      error: () => {
        // Silently ignore — next poll cycle will retry.
      }
    });
  }

  /** Marks a request as handled. The row disappears immediately; the server is the source of truth afterwards. */
  completeRequest(id: string): void {
    this.pendingRequests.set(this.pendingRequests().filter((r) => r.id !== id));
    this.requestService.complete(id).subscribe({
      next: () => this.refreshRequests(),
      error: () => this.refreshRequests()
    });
  }

  private announceRequests(requests: ServiceRequest[]): void {
    this.playChime();
    requests.forEach((request) => {
      const meta = serviceRequestMeta(request.type);
      this.pushRequestToast(meta.emoji, meta.adminText(request.tableNumber));
    });
    setTimeout(() => {
      requests.forEach((request) => this.speak(serviceRequestMeta(request.type).adminText(request.tableNumber)));
    }, 450);
  }

  private pushRequestToast(icon: string, message: string): void {
    const toast: OrderToast = { id: `toast-${++this.toastCounter}`, kind: 'request', icon, message, amount: null };
    this.toasts.set([...this.toasts(), toast]);
    setTimeout(() => this.dismissToast(toast.id), 10000);
  }

  private pushToast(order: Order): void {
    const toast: OrderToast = {
      id: `toast-${++this.toastCounter}`,
      kind: 'order',
      icon: null,
      message: order.tableNumber ? `New order received from Table ${order.tableNumber}` : 'New order received',
      amount: order.total
    };
    this.toasts.set([...this.toasts(), toast]);
    setTimeout(() => this.dismissToast(toast.id), 6000);
  }

  /** Browsers keep an AudioContext "suspended" (silent) until the user has interacted
   * with the page. Poll callbacks are not user gestures, so we prepare the context on
   * the first click / key press / touch anywhere in the admin panel. */
  private registerAudioUnlock(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices(); // triggers async voice list loading
    }
    this.unlockEvents.forEach((e) => window.addEventListener(e, this.unlockAudioHandler));
  }

  private unlockAudio(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      this.unlockEvents.forEach((e) => window.removeEventListener(e, this.unlockAudioHandler));
    } catch {
      // No AudioContext support — stay silent.
    }
  }

  /** Ding first, then speak "New order received from table <no>" for every new order. */
  private announce(orders: Order[]): void {
    this.playChime();
    // Let the ding (~0.4s) finish before the voice starts. speechSynthesis queues
    // utterances itself, so several simultaneous orders are read out one after another.
    setTimeout(
      () =>
        orders.forEach((o) =>
          this.speak(o.tableNumber ? `New order received from table ${o.tableNumber}` : 'New order received')
        ),
      450
    );
  }

  /** Preferred female voices, best first. Which ones exist depends on browser / OS. */
  private static readonly FEMALE_VOICE_HINTS = [
    'neerja',        // Edge: Microsoft Neerja Online (Natural) - English (India)
    'heera',         // Windows: Microsoft Heera - English (India)
    'veena',         // macOS / iOS: en-IN
    'google uk english female',
    'samantha',
    'zira',
    'google हिन्दी',
    'female'
  ];

  private pickFemaleVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    for (const hint of OrderNotificationService.FEMALE_VOICE_HINTS) {
      // Prefer voices installed on the device: network voices (e.g. "Google ...")
      // can fail silently, so a local match wins over a remote one.
      const matches = voices.filter((v) => v.name.toLowerCase().includes(hint));
      const match = matches.find((v) => v.localService) ?? matches[0];
      if (match) {
        return match;
      }
    }
    return null;
  }

  private speak(text: string): void {
    if (!('speechSynthesis' in window)) {
      return;
    }
    const synth = window.speechSynthesis;
    // Chrome can get stuck in a paused state after idling; wake it up first.
    synth.resume();

    const build = (voice: SpeechSynthesisVoice | null): SpeechSynthesisUtterance => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = 'en-IN';
      }
      u.pitch = 1.15; // slightly higher = softer, sweeter
      u.rate = 0.92;  // slightly slower = clearer, calmer
      return u;
    };

    const voice = this.pickFemaleVoice();
    const utterance = build(voice);
    // If the chosen voice fails, retry once with the browser default voice.
    utterance.onerror = (e) => {
      console.warn('Speech failed with voice', voice?.name, e.error);
      if (voice) {
        synth.speak(build(null));
      }
    };
    // Keep a reference until finished (Chrome may garbage-collect it mid-speech).
    this.currentUtterance = utterance;
    synth.speak(utterance);
  }

  /** Two-tone "ding" synthesized on the fly so a new order doesn't need a bundled
   * audio asset. Degrades to silent if audio hasn't been unlocked by a user gesture. */
  private playChime(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;

      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.13;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch {
      // Autoplay restrictions or no AudioContext support — fail silently.
    }
  }
}

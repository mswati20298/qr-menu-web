import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Review, ReviewInput } from '../../core/models/review.model';
import { OrderService } from '../../core/services/order.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PublicSessionService } from '../../core/services/public-session.service';
import { ReviewService } from '../../core/services/review.service';
import { UploadService } from '../../core/services/upload.service';
import { RatingSheet } from '../components/rating-sheet/rating-sheet';
import { BillSummary } from '../components/bill-summary/bill-summary';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { UpiPayCard } from '../components/upi-pay-card/upi-pay-card';
import { errorMessage } from '../../core/utils/http-error';
import { BillBreakup, ratesOf } from '../../core/services/billing.util';
import { AppIcon } from '../../shared/app-icon/app-icon';

const STATUS_STEPS: OrderStatus[] = ['Placed', 'Preparing', 'Served', 'Completed'];
const POLL_INTERVAL_MS = 8000;

@Component({
  selector: 'app-order-status-page',
  imports: [BillSummary, ConfirmDialog, UpiPayCard, RatingSheet, AppIcon],
  templateUrl: './order-status-page.html',
  styleUrl: './order-status-page.scss'
})
export class OrderStatusPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  readonly session = inject(PublicSessionService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private readonly reviews = inject(ReviewService);
  private readonly uploads = inject(UploadService);

  readonly statusSteps = STATUS_STEPS;
  readonly order = signal<Order | null>(null);
  /** The order's own amounts and the rates they were charged at (not today's restaurant settings). */
  readonly orderBill = computed<BillBreakup | null>(() => {
    const o = this.order();
    return o ? { subtotal: o.subtotal, serviceChargeAmount: o.serviceChargeAmount, gstAmount: o.gstAmount, total: o.total } : null;
  });
  readonly orderRates = computed(() => {
    const bill = this.orderBill();
    return bill ? ratesOf(bill) : { gstPercentage: 0, serviceChargePercentage: 0 };
  });
  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly showCancelConfirm = signal(false);

  // Rating this order: shown once the order is placed (not for a cancelled one).
  readonly review = signal<Review | null>(null);
  readonly reviewSheetOpen = signal(false);
  readonly savingReview = signal(false);
  /** Star tapped on the page card, carried into the sheet. */
  private readonly pickedStar = signal(0);
  readonly reviewStart = computed<ReviewInput | null>(() => {
    const r = this.review();
    return r ? { rating: r.rating, name: r.name, comment: r.comment, imageUrl: r.imageUrl } : null;
  });
  readonly sheetStart = computed<ReviewInput | null>(() => {
    const start = this.reviewStart();
    const star = this.pickedStar();
    if (star) {
      return { rating: star, name: start?.name ?? null, comment: start?.comment ?? null, imageUrl: start?.imageUrl ?? null };
    }
    return start;
  });
  readonly uploadPhoto = (file: File) => this.reviews.uploadGuestPhoto(this.slug, this.orderId, file);
  readonly resolveUrl = (url: string | null) => this.uploads.thumbUrl(url, 160);
  slug = '';
  private orderId = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? this.route.parent?.snapshot.paramMap.get('slug') ?? '';
    this.orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
    this.session.init(this.slug, this.session.tableNumber());
    this.fetchOrder();
    this.reviews.forOrder(this.slug, this.orderId).subscribe({
      next: (review) => this.review.set(review),
      error: () => {
        // Not critical: the rating card simply starts empty.
      }
    });

    this.pollHandle = setInterval(() => {
      // Keep checking while the kitchen is working, and while staff have not yet confirmed a UPI payment.
      const order = this.order();
      const cooking = order && order.status !== 'Completed' && order.status !== 'Cancelled';
      const awaitingPayment = order?.paymentStatus === 'Claimed';
      if (cooking || awaitingPayment) {
        this.fetchOrder();
      }
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
  }

  private fetchOrder(): void {
    this.orderService.getPublicOrder(this.slug, this.orderId).subscribe({
      next: (order) => {
        const before = this.order()?.status;
        if (before && before !== order.status) {
          this.announceStatus(order.status);
        }
        this.order.set(order);
        this.loading.set(false);
        this.maybeAskForReview(order);
      },
      error: () => this.loading.set(false)
    });
  }

  /** A pop-up for the guest when the kitchen moves the order on (they may not be looking at the steps). */
  private announceStatus(status: OrderStatus): void {
    const messages: Partial<Record<OrderStatus, string>> = {
      Placed: 'Your order is placed. The kitchen has it.',
      Preparing: 'The kitchen has started preparing your order.',
      Served: 'Your food is served. Enjoy your meal!',
      Completed: 'Order completed. Thank you for dining with us!'
    };
    if (status === 'Cancelled') {
      this.feedback.error('This order was cancelled by the restaurant. Please ask the staff if you need help.');
      return;
    }
    const message = messages[status];
    if (message) {
      this.feedback.success(message);
      navigator.vibrate?.(60);
    }
  }

  stepIndex(status: OrderStatus): number {
    return this.statusSteps.indexOf(status);
  }

  tableLabel(): string {
    const table = this.order()?.tableNumber;
    return table ? `Table ${table}` : 'Takeaway';
  }

  statusHeroClass(): string {
    const status = this.order()?.status;
    if (status === 'Preparing') return 'order-status-page__hero--preparing';
    if (status === 'Served' || status === 'Completed') return 'order-status-page__hero--served';
    if (status === 'Cancelled') return 'order-status-page__hero--cancelled';
    return 'order-status-page__hero--placed';
  }

  statusTitle(): string {
    const status = this.order()?.status;
    switch (status) {
      case 'Preparing': return 'Being prepared';
      case 'Served': return 'Served — enjoy!';
      case 'Completed': return 'Order completed';
      case 'Cancelled': return 'Order cancelled';
      default: return 'Order placed!';
    }
  }

  saveReview(input: ReviewInput): void {
    this.savingReview.set(true);
    this.reviews.submitForOrder(this.slug, this.orderId, input).subscribe({
      next: (review) => {
        this.savingReview.set(false);
        this.review.set(review);
        this.reviewSheetOpen.set(false);
        this.feedback.success('Thank you for your rating!');
      },
      error: (err) => {
        this.savingReview.set(false);
        // Validation errors come as a list or as { field: [messages] }.
        const errors = err?.error?.errors;
        const first = Array.isArray(errors) ? errors[0] : errors ? (Object.values(errors)[0] as string[] | undefined)?.[0] : null;
        this.feedback.error(first ?? errorMessage(err, 'Could not send your rating. Please try again.'));
      }
    });
  }

  openReview(star = 0): void {
    this.pickedStar.set(star);
    this.reviewSheetOpen.set(true);
  }

  closeReview(): void {
    this.reviewSheetOpen.set(false);
    this.rememberAsked();
  }

  /** Once the food is served, ask once (not again after "Maybe later", not after a rating). */
  private maybeAskForReview(order: Order): void {
    const done = order.status === 'Served' || order.status === 'Completed';
    if (!done || this.review() || this.reviewSheetOpen() || this.alreadyAsked()) {
      return;
    }
    this.rememberAsked();
    setTimeout(() => {
      if (!this.review()) {
        this.openReview();
      }
    }, 1500);
  }

  private alreadyAsked(): boolean {
    try {
      return localStorage.getItem(`qrenvo_review_asked_${this.orderId}`) === '1';
    } catch {
      return true;
    }
  }

  private rememberAsked(): void {
    try {
      localStorage.setItem(`qrenvo_review_asked_${this.orderId}`, '1');
    } catch {
      // Private mode: the sheet may ask again next time, which is fine.
    }
  }

  starsText(rating: number): string {
    return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
  }

  backToMenu(): void {
    this.router.navigate(['/m', this.slug, 'menu']);
  }

  requestCancelOrder(): void {
    this.showCancelConfirm.set(true);
  }

  dismissCancelConfirm(): void {
    this.showCancelConfirm.set(false);
  }

  confirmCancelOrder(): void {
    this.showCancelConfirm.set(false);
    this.cancelling.set(true);

    this.orderService.cancelOrder(this.slug, this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.cancelling.set(false);
        this.feedback.success('Order cancelled.');
      },
      error: (err) => {
        this.cancelling.set(false);
        this.feedback.error(errorMessage(err, 'Could not cancel this order. Please try again.'));
      }
    });
  }
}

import { Checkout, ConfirmCheckoutRequest } from '../models/subscription.model';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads Razorpay's checkout script once, on first use. */
function loadScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the payment window. Check your internet connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export type CheckoutResult =
  | { kind: 'paid'; confirmation: ConfirmCheckoutRequest }
  | { kind: 'dismissed' }
  | { kind: 'failed'; message: string };

/**
 * Opens Razorpay's payment window for an order the API created. Resolves when the owner pays,
 * closes the window, or the payment fails. The plan is only applied after the API checks the signature.
 */
export async function openRazorpayCheckout(checkout: Checkout, themeColor: string): Promise<CheckoutResult> {
  await loadScript();

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const razorpay = new window.Razorpay!({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: 'QR Menu',
      description: `${checkout.planName} plan · ${checkout.restaurantName}`,
      prefill: {
        name: checkout.ownerName ?? undefined,
        email: checkout.ownerEmail ?? undefined,
        contact: checkout.contact ?? undefined
      },
      theme: { color: themeColor },
      handler: (response: RazorpaySuccess) =>
        finish({
          kind: 'paid',
          confirmation: {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          }
        }),
      modal: { ondismiss: () => finish({ kind: 'dismissed' }) }
    });

    razorpay.on('payment.failed', (response) =>
      finish({ kind: 'failed', message: response.error?.description ?? 'The payment failed. No money was taken.' })
    );
    razorpay.open();
  });
}

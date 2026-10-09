/**
 * The message to show for a failed API call: the first validation error, else the API's message, else the fallback.
 * Works for HttpErrorResponse and for plain Errors (e.g. thrown by the Razorpay checkout).
 */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { error?: { errors?: string[]; message?: string }; message?: string } | null;
  return e?.error?.errors?.[0] ?? e?.error?.message ?? fallback;
}

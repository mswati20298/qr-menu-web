/**
 * The message to show for a failed API call: the first validation error, else the API's message, else the fallback.
 * Understands our own errors ({ message, errors: [] }) and ASP.NET validation problems ({ errors: { Price: [...] } }).
 * Works for HttpErrorResponse and for plain Errors (e.g. thrown by the Razorpay checkout).
 */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { error?: { errors?: unknown; message?: string; title?: string }; message?: string } | null;
  const errors = e?.error?.errors;
  if (Array.isArray(errors) && typeof errors[0] === 'string') {
    return errors[0];
  }
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors as Record<string, unknown>).flat().find((v) => typeof v === 'string');
    if (typeof first === 'string') {
      return tidy(first);
    }
  }
  return e?.error?.message ?? fallback;
}

/** "'Price' must be greater than '0'." -> "Price must be greater than 0." */
function tidy(message: string): string {
  return message.replace(/'([^']*)'/g, '$1');
}

import { BACKGROUND_SLOT, BackgroundMode, PublicBackground } from './models/background.model';

/** Time-of-day slot for a given moment, in the viewer's local time.
 * Morning 5:00-11:59 · Afternoon 12:00-16:59 · Evening 17:00-19:59 · Night 20:00-4:59 */
export function currentSlot(now: Date): number {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) {
    return BACKGROUND_SLOT.Morning;
  }
  if (hour >= 12 && hour < 17) {
    return BACKGROUND_SLOT.Afternoon;
  }
  if (hour >= 17 && hour < 20) {
    return BACKGROUND_SLOT.Evening;
  }
  return BACKGROUND_SLOT.Night;
}

/** Picks which background image to show.
 * Fixed: the default image. TimeOfDay: the image assigned to the current slot,
 * falling back to the default image when no image is assigned to it. */
export function pickBackgroundUrl(
  mode: BackgroundMode,
  items: PublicBackground[],
  now: Date = new Date()
): string | null {
  if (items.length === 0) {
    return null;
  }

  if (mode === 'TimeOfDay') {
    const slot = currentSlot(now);
    const match = items.find((item) => (item.slots & slot) !== 0);
    if (match) {
      return match.imageUrl;
    }
  }

  return (items.find((item) => item.isDefault) ?? items[0]).imageUrl;
}

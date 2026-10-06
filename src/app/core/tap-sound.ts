/**
 * A short, soft "ding" for customer taps (water, bill, call waiter). Made with the Web Audio API, so there
 * is no sound file to download. Must be called from a tap: browsers only allow sound after the user acts.
 */
let context: AudioContext | null = null;

export function playDing(): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime;
    // Two quick bell-like notes, the second a fifth higher.
    for (const [frequency, start] of [[880, 0], [1320, 0.09]] as const) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.35);
      osc.connect(gain).connect(context.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.4);
    }
  } catch {
    // No Web Audio support: the toast still confirms the tap.
  }
}

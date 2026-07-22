/**
 * Vibration feedback for phones — the one channel that still lands when the
 * player has the sound off or is looking at their own fingers instead of the
 * screen. A no-op everywhere the Vibration API is missing (desktop, iOS
 * Safari), so call sites never have to branch on support.
 *
 * Deliberately independent of the mute setting: muting is about not making
 * noise in public, which is exactly when a buzz is the most useful.
 */
function buzz(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if the page hasn't been interacted with yet.
  }
}

export const haptics = {
  /** A single wrong keystroke or tap — short and sharp. */
  error: () => buzz(35),
  /** A life lost — two firmer pulses, so it can't be read as a typo. */
  fail: () => buzz([45, 60, 90]),
};

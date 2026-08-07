/**
 * ⚠️ DEV-ONLY TOGGLES — flip these OFF before deploying. ⚠️
 */

/**
 * While true, losing a life is a no-op in every game: hearts stay full and a
 * run never ends early — useful for walking through late rounds without
 * having to survive the early ones.
 *
 * MUST be false in anything you deploy, or no run can ever be lost and every
 * game is unloseable. This is the shipping value; flip it on locally, flip it
 * back before you commit.
 */
export const UNLIMITED_LIVES = false;

import { colors } from './colors';
import { nowISO } from './logger';

/**
 * Convert epoch seconds (if present) to an ISO date string, otherwise return 'N/A'.
 */
export function prettyDateFromEpochSeconds(sec: number | null) {
  return sec ? new Date(sec * 1000).toISOString() : 'N/A';
}

/**
 * Promise-based sleep helper that resolves after `ms` milliseconds.
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the provided time (ms) while showing a per-second countdown
 * printed in the terminal. This function accepts an optional `isStopped`
 * callback so the caller can indicate when to abort early (e.g., SIGINT).
 *
 * NOTE: We import `nowISO` and `colors` from the shared logging modules
 * so this routine can print consistent time/colorized output.
 */
export async function waitWithCountdown(ms: number, isStopped?: () => boolean) {
  const step = 1000; // update once per second
  let remaining = ms;
  while (remaining > 0 && !(isStopped && isStopped())) {
    const remainingSec = Math.ceil(remaining / 1000);
    // Display an in-place countdown so users watching the terminal can see
    // when the next poll will happen. `\r` is used to overwrite the same line.
    process.stdout.write(
      `${colors.magenta}[WAIT ${nowISO()}]${colors.reset} Next poll in ${remainingSec}s...   \r`,
    );
    await sleep(step);
    remaining -= step;
  }
  process.stdout.write('\n');
}

export default { prettyDateFromEpochSeconds, sleep, waitWithCountdown };

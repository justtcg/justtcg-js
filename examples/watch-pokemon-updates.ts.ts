/**
 * Example: Watch / Poll for Pokemon updates using the `updated_after` filter.
 *
 * This script demonstrates a simple, robust, long-running polling example that:
 * - Asks the games endpoint for the latest `last_updated` timestamp for Pokemon
 * - Keeps a baseline timestamp in memory
 * - On each poll, checks for a new game-level timestamp
 * - If new updates exist, fetches the cards updated since the previous baseline
 * - Outputs clear terminal logs on each step so developers can easily understand
 *   what is going on when running the example as a long-lived process
 *
 * Important production notes:
 * - This example keeps the baseline timestamp in-memory only. If this script
 *   restarts, it will re-establish the baseline via `games.list()`. If you need
 *   to maintain exactly-once semantics across restarts, persist the baseline to
 *   disk (file, database) and read it back on start.
 *
 * Environment:
 * - POLL_INTERVAL_MS: (optional) number of milliseconds to wait between polls.
 *   Defaults to 5 minutes (300,000 ms).
 * - POLL_MODE: 'incremental' (default) or 'snapshot'. When 'snapshot' the script
 *   uses a full card fetch for the detected update window (no `updated_after`).
 * - FULL_REFRESH: alias for POLL_MODE=snapshot. Example: `FULL_REFRESH=true npx ts-node ...` (or set `POLL_MODE=express` as a shorthand alias)
 * - FETCH_INITIAL_SNAPSHOT: if true will perform a snapshot fetch on first poll.
 * - COMPACT_LOGS: when true (default), the script prints a concise, one-line
 *   summary per poll and only prints detailed logs if set to false.
 * - POLL_MODE: 'incremental' (default) or 'snapshot'. When 'snapshot' the script
 *   uses a full card fetch (no `updated_after`) when `games.last_updated` changes.
 * - FULL_REFRESH: alias for POLL_MODE=snapshot. Example: `FULL_REFRESH=true npx ts-node ...` or set `POLL_MODE=express`
 *
 * Usage:
 * - Run with `npx ts-node examples/watch-pokemon-updates.ts` (if you have `ts-node`)
 * - Or compile and run the built JS in `dist` if you prefer.
 *
 * Examples:
 * - Run in incremental mode (default):
 *   - Windows (PowerShell):
 *       $env:POLL_INTERVAL_MS = '10000'; npx ts-node .\examples\watch-pokemon-updates.ts
 * - Run in snapshot (no updated_after) mode:
 *   - Windows (PowerShell):
 *       $env:FULL_REFRESH = 'true'; $env:POLL_INTERVAL_MS = '10000'; npx ts-node .\examples\watch-pokemon-updates.ts
 * - Run with verbose logs (COMPACT_LOGS=false):
 *     $env:COMPACT_LOGS = 'false'; $env:POLL_INTERVAL_MS = '10000'; npx ts-node .\examples\watch-pokemon-updates.ts
 */
import { JustTCG } from '../dist';
import { logDebug, logCompact, logInfo, logWarn, logError } from './logging/logger';
import { prettyDateFromEpochSeconds, waitWithCountdown } from './logging/utils';

// Initialize the JustTCG client. In production, prefer reading the API key from
// an environment variable (process.env.JUSTTCG_API_KEY) or use a secrets manager.
const client = new JustTCG();

// 1. Keep track of the last updated timestamp
/**
 * The `lastKnownBaseline` holds the integer epoch seconds value returned by the
 * `games.list()` endpoint for Pokemon's `last_updated` field. We keep this as the
 * baseline for `updated_after` requests when fetching new/updated cards.
 *
 * Note: this is a timestamp in seconds since epoch (not ms). We use `null` to
 * indicate that no baseline has been established yet.
 */
let lastKnownBaseline: number | null = null;

// polling settings
// POLL_INTERVAL_MS: how long to wait in ms between polls (default 5 minutes)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 300_000; // default 5 minutes
// Whether to perform an initial 'snapshot' fetch on startup when no baseline
// is available. Default true so the example fetches all cards on first poll.
// If POLL_MODE is 'snapshot', the initial snapshot is equivalent to how a
// snapshot-mode fetch will work for subsequent updates (but it still only
// occurs when `games.last_updated` changes).
const FETCH_INITIAL_SNAPSHOT = process.env.FETCH_INITIAL_SNAPSHOT
  ? String(process.env.FETCH_INITIAL_SNAPSHOT).toLowerCase() === 'true'
  : true;
// Poll mode: 'incremental' (default) uses updated_after to fetch deltas.
// 'snapshot' (aka 'full-refresh') fetches all cards for the detected update window
// (without `updated_after`). You can also set `FULL_REFRESH=true` as a convenience
// to enable snapshot mode from simple shells.
const rawPollMode = (
  process.env.POLL_MODE || (process.env.FULL_REFRESH ? 'snapshot' : 'incremental')
).toLowerCase();
// Accept 'express' as a convenient alias for 'snapshot' if desired.
const POLL_MODE = rawPollMode === 'express' ? 'snapshot' : rawPollMode;
const IS_SNAPSHOT_MODE = POLL_MODE === 'snapshot';
// Whether the polling loop should stop. Flips to `true` from SIGINT/SIGTERM.
// Control and counters used by the polling script. These are purposefully simple
// so developers can see how the example keeps track of runtime state.
let stopped = false;
let pollCount = 0;
// Track any consecutive failures (helpful for monitoring backoff or alerts).
let consecutiveErrors = 0;
// Session metrics for demonstration only.
let totalCardsFetched = 0;
let lastFetchedCount = 0;

async function fetchLastUpdatedTimestamp(): Promise<number | null> {
  /**
   * Fetch the current Pokemon game's `last_updated` timestamp.
   *
   * The function queries `/games`, looks up the `pokemon` entry by name and
   * returns the `last_updated` value as an integer. If the Pokemon game is not
   * found, we `throw` to indicate a critical error — the script depends on this.
   *
   * Return: epoch seconds (number) or `null` if the endpoint returns `null`.
   */
  logDebug('Querying /games for the latest Pokemon last_updated timestamp...');
  const gamesResponse = await client.v1.games.list();
  if (gamesResponse.error) {
    logError(`Error fetching games: ${gamesResponse.error}`);
    throw new Error(`Error fetching games: ${gamesResponse.error}`);
  }

  const pokemonGame = gamesResponse.data.find(
    (game) => game.name.toLowerCase() === 'pokemon',
  );
  if (!pokemonGame) {
    logError('Pokemon game not found in the games list.');
    throw new Error('Pokemon game not found in the games list.');
  }

  // The API uses seconds since epoch. Convert to a Number for safety.
  const ts = pokemonGame.last_updated ? Number(pokemonGame.last_updated) : null;
  logDebug(`Pokemon game last_updated: ${ts ?? 'N/A'} (${prettyDateFromEpochSeconds(ts)})`);
  return ts;
}

// `sleep` is provided by `examples/logging/utils.ts`.

// `waitWithCountdown` is provided by `examples/logging/utils.ts` and accepts an
// optional `isStopped` check callback, passed by the example when invoked.

async function pollForUpdatedCards() {
  /**
   * The main polling loop. The sequence is:
   *  - On first run, set a baseline timestamp from `games.list()` and
   *    - If FETCH mode,
   *    - I don't fetch cards.
   *  - In each subsequent poll:
   *    - Ask the games endpoint for the new latest `last_updated`.
   *    - Compare this `newTimestamp` to our `lastKnownBaseline`.
   *    - If `newTimestamp` > `lastKnownBaseline` then we have updates. We must
   *      fetch cards with `updated_after` = `lastKnownBaseline` (not `newTimestamp`)
   *      to retrieve the interval of changes since the last baseline.
   *    - Update the `lastKnownBaseline` to `newTimestamp` after fetching.
   *
   * This logic is crucial: `updated_after` should be the previous baseline so we
   * can fetch any changes that happened since that moment. Passing the new
   * timestamp would skip any recent updates.
   */
  logInfo(
    `Starting polling loop for Pokemon updates. Poll interval: ${POLL_INTERVAL_MS}ms. Mode: ${POLL_MODE}`,
  );
  if (IS_SNAPSHOT_MODE) {
    logWarn(
      'POLL_MODE=snapshot: Using snapshot fetch for updates (no updated_after). Fetches still only occur when `games.last_updated` changes.',
    );
  }
  // We intentionally do *not* set a baseline outside the loop so that the
  // first poll can decide whether to do an initial snapshot fetch.

  while (!stopped) {
    pollCount += 1;
    const pollStart = Date.now();
    logDebug(`Starting poll #${pollCount}.`);

    // Per-poll state for printing a single-line summarized result.
    let action = 'none';
    let fetchedCountForPoll = 0;
    // Capture previous baseline at the start of the poll so it remains stable
    // throughout the iteration even if we change the baseline during processing.
    const previousTimestamp = lastKnownBaseline;
    let newTimestamp: number | null = null;
    try {
      // previous timestamp (our last known baseline) and the latest remote value
      // Get latest remote timestamp
      newTimestamp = await fetchLastUpdatedTimestamp();

      if (!previousTimestamp) {
        logCompact(
          `[POLL ${pollCount}] baseline=<unset> latest=${newTimestamp} (${prettyDateFromEpochSeconds(newTimestamp)}) action=${FETCH_INITIAL_SNAPSHOT || IS_SNAPSHOT_MODE ? 'initial-snapshot' : 'set-baseline'} fetched=-- total=${totalCardsFetched} errs=${consecutiveErrors}`,
        );
        // If the developer wants to get a snapshot of all current cards on
        // the first poll, optionally perform that fetch now.
        if (FETCH_INITIAL_SNAPSHOT) {
          logInfo(
            'FETCH_INITIAL_SNAPSHOT is enabled. Performing initial snapshot (full) card fetch.',
          );
          try {
            const cardsResponse = await client.v1.cards.get({ game: 'pokemon' });
            if (cardsResponse.error) {
              logError(`Error fetching initial snapshot: ${cardsResponse.error}`);
            } else {
              lastFetchedCount = cardsResponse.data.length;
              fetchedCountForPoll = lastFetchedCount;
              totalCardsFetched += lastFetchedCount;
              logDebug(
                `Initial snapshot fetched ${lastFetchedCount} cards. Running total: ${totalCardsFetched}`,
              );
              // Update baseline so next poll will seek incremental updates
              lastKnownBaseline = newTimestamp;
              action = 'initial-snapshot';

              // [INITIAL SNAPSHOT PROCESSING]
              // [YOUR CODE HERE]
              // Process the fetched cards as needed. This example only logs the count.
              // In a real application, you might save them to a database or similar.
            }
          } catch (err) {
            logError(`Failed to fetch initial snapshot: ${err}`);
          }
        }
        // If the developer has opted-out of the initial snapshot set a baseline to 
        // avoid repeatedly entering this first-run logic every poll.
        if (!FETCH_INITIAL_SNAPSHOT) {
          lastKnownBaseline = newTimestamp;
        }
        // We purposely do not `continue` here: after performing the initial
        // snapshot we still have a valid baseline and should check for updates.
        // Now: regardless of polling mode, only query cards when the game's
        // `last_updated` timestamp changed (i.e., we've detected updates). Only
        // difference between modes is whether we pass `updated_after` (incremental)
        // or omit it (snapshot) when fetching.
      } else if (newTimestamp && previousTimestamp && newTimestamp > previousTimestamp) {
        logInfo(
          `New updates detected. previous=${previousTimestamp} (${prettyDateFromEpochSeconds(previousTimestamp)}), latest=${newTimestamp} (${prettyDateFromEpochSeconds(newTimestamp)})`,
        );
        // Determine whether we should use incremental fetching (updated_after)
        // or snapshot fetching (get all cards). Snapshot mode is useful for testing,
        // development, or if you intentionally want to refetch the entire dataset
        // for this update window.
        let cardsResponse;
        if (IS_SNAPSHOT_MODE) {
          logDebug(
            'POLL_MODE=snapshot: Fetching full card catalog for this update (no `updated_after`).',
          );
          cardsResponse = await client.v1.cards.get({ game: 'pokemon' });
        } else {
          logDebug('POLL_MODE=incremental: Fetching updated cards using updated_after filter.');
          // Build the typed argument for the `cards.get` method. The SDK expects
          // `updated_after` to be a number; we can assert this safely because we
          // are inside a branch that ensures `previousTimestamp` is defined.
          cardsResponse = await client.v1.cards.get({
            game: 'pokemon',
            updated_after: previousTimestamp!,
          });
        }

        if (cardsResponse.error) {
          logError(`Error fetching updated cards: ${cardsResponse.error}`);
        } else {
          // Update counters and then update the baseline so the next poll only
          // fetches things changed after `newTimestamp` when in incremental mode.
          // For snapshot mode we still update the baseline to avoid always treating
          // the next poll as a delta window startup.
          lastFetchedCount = cardsResponse.data.length;
          fetchedCountForPoll = lastFetchedCount;
          totalCardsFetched += lastFetchedCount;
          // Update the baseline only after a successful fetch to avoid skipping data.
          lastKnownBaseline = newTimestamp;
          action = IS_SNAPSHOT_MODE ? 'snapshot' : 'incremental';
          logCompact(
            `[POLL ${pollCount}] baseline=${previousTimestamp} latest=${newTimestamp} action=${IS_SNAPSHOT_MODE ? 'snapshot' : 'incremental'} fetched=${lastFetchedCount} total=${totalCardsFetched} errs=${consecutiveErrors}`,
          );

          // [UPDATED CARDS PROCESSING]
          // [YOUR CODE HERE]
          // Process the updated cards as needed. For example, you might:
          // - Save them into a database
          // - Emit them into a message queue
          // - Compare them against a local cache and apply business logic
          // This example only shows a count because the processing needs are
          // project-specific.
        }
      } else {
        // keep action=none and fetchedCountForPoll=0
      }

      // Reset the consecutive error counter on success.
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors += 1;
      logError(`Error during poll #${pollCount}: ${error}`);
      logWarn(`Consecutive errors: ${consecutiveErrors}`);
    } finally {
      const pollDuration = Date.now() - pollStart;
      // Single-line summary per poll (more concise); include duration
      logCompact(
        `[POLL ${pollCount}] baseline=${previousTimestamp ?? 'unset'} latest=${newTimestamp ?? 'N/A'} action=${action} fetched=${fetchedCountForPoll} total=${totalCardsFetched} dur=${pollDuration}ms errs=${consecutiveErrors}`,
      );
      // Wait with countdown unless stopped
      await waitWithCountdown(POLL_INTERVAL_MS, () => stopped);
    }
  }

  logInfo('Polling loop ended.');
}

/**
 * Graceful shutdown handler. When a SIGINT/SIGTERM arrives we stop the
 * polling loop, let the current iteration complete and then exit the
 * process a short while later. This helps ensure we don't abruptly stop
 * while in the middle of processing a response.
 */
function handleShutdown() {
  if (!stopped) {
    stopped = true;
    logInfo('Shutdown requested, stopping gracefully...');
    // Give time for any in-flight work to finish
    setTimeout(() => {
      logInfo('Exiting now.');
      process.exit(0);
    }, 1000);
  }
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Start polling for updated cards
logInfo(
  'Starting watcher for Pokemon updates using the `updated_after` filter. (examples/watch-pokemon-updates.ts)',
);
// Kick off the polling loop. The promise is top-level so we can handle any
// unhandled rejections and exit with a non-zero status.
pollForUpdatedCards().catch((err) => {
  logError(`Unhandled error in polling loop: ${err}`);
  process.exit(1);
});

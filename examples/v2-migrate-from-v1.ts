import { JustTCG, toV1Cards } from '../src';
import type { Card } from '../src';
import { NotFoundError, RateLimitError } from '../src';

/**
 * Migrating an existing v1 integration to v2 without rewriting your downstream code.
 *
 * `toV1Cards` reshapes v2 cards back into the exact v1 `Card` shape, so a codebase that already has
 * `Card`/`Variant` type annotations everywhere can switch endpoints by changing one line — the
 * fetch — and running the results through the adapter.
 *
 * It also shows the new typed errors: v2 (and now v1) throw `JustTCGError` subclasses you can
 * branch on, instead of returning an `error` string on the response.
 */
async function main() {
  try {
    const client = new JustTCG();

    // Before: const { data } = await client.v1.cards.get({ game: 'pokemon', limit: 5 });
    // After — fetch with v2, then adapt:
    const { data: v2Cards } = await client.v2.cards.get({ game: 'pokemon', limit: 5 });

    // `legacy` is typed as the v1 `Card[]`, so everything downstream keeps compiling unchanged.
    const legacy: Card[] = toV1Cards(v2Cards);

    for (const card of legacy) {
      const variant = card.variants[0];
      // These are all v1 field names: flat `price`, `avgPrice` (the 7d mean), `game` as a string.
      console.log(`${card.name} (${card.game}) — $${variant?.price?.toFixed(2) ?? 'N/A'}`);
      console.log(`  7d avg: $${variant?.avgPrice?.toFixed(2) ?? 'N/A'}`);
    }

    // Adapt a single card, and choose which region flattens into the price fields.
    const single = await client.v2.cards.retrieve(v2Cards[0].id, { regions: ['UK', 'US'] });
    const [uk] = toV1Cards([single.data], { region: 'UK' });
    console.log(`\n${uk.name} priced in the UK market: £${uk.variants[0]?.price ?? 'N/A'}`);

    // --- typed error handling --------------------------------------------------------------
    try {
      await client.v2.cards.retrieve('a-card-that-does-not-exist');
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.log('\nLookup missed, as expected — caught NotFoundError.');
      } else if (error instanceof RateLimitError) {
        console.log(`Rate limited; retry after ${error.retryAfter}s.`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

main();

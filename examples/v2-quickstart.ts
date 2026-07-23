import { JustTCG } from '../src';

/**
 * The v2 API (public beta), end to end: search, a direct lookup, and a localized price.
 *
 * v2 lives alongside v1 on the same client — reaching for `client.v2` changes nothing about how
 * `client.v1` behaves. The response envelope is the same `{ data, pagination?, usage }` you know
 * from v1, but usage now comes from the `RateLimit-*` headers and pagination is cursor-based.
 */
async function quickstart() {
  try {
    const client = new JustTCG();

    // --- search ----------------------------------------------------------------------------
    console.log('Searching for Charizard in Pokemon...');
    const search = await client.v2.cards.search('charizard', { game: 'pokemon', limit: 5 });

    for (const card of search.data) {
      // markets[0] is the primary market — the drop-in replacement for v1's flat `price`.
      const price = card.variants[0]?.markets[0]?.price;
      console.log(`  ${card.name} (${card.set.name}) — $${price?.toFixed(2) ?? 'N/A'}`);
    }
    console.log(`  hasMore: ${search.pagination?.hasMore}`);

    // --- direct lookup ---------------------------------------------------------------------
    // `retrieve` accepts either the v2 UUID or a legacy v1 slug, and unwraps the single card.
    const first = search.data[0];
    if (first) {
      const { data: card } = await client.v2.cards.retrieve(first.id);
      console.log(`\nRetrieved ${card.name} directly — ${card.variants.length} variant(s).`);
    }

    // --- a localized price -----------------------------------------------------------------
    // Request two regions in priority order; markets come back in the same order. Prices are never
    // currency-converted — each market's price is the real price observed in that region.
    const localized = await client.v2.cards.search('pikachu', {
      game: 'pokemon',
      regions: ['UK', 'US'],
      limit: 1,
    });
    const variant = localized.data[0]?.variants[0];
    if (variant) {
      for (const market of variant.markets) {
        const price = market.price?.toFixed(2) ?? 'no local data';
        console.log(`  ${market.region}: ${price} ${market.currency}`);
      }
    }

    console.log(`\nAPI requests remaining: ${localized.usage.remaining ?? 'unknown'}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

quickstart();

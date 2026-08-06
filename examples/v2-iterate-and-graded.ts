import { JustTCG } from '../src';

/**
 * Two things v2 adds over v1: cursor iteration across an entire result set, and graded cards.
 *
 * `iterate()` walks every page lazily — it only fetches the next page when you ask for the next
 * card, so breaking out of the loop stops the requests. That makes it safe to point at a large set.
 */
async function main() {
  try {
    const client = new JustTCG();

    // --- walk a whole set, but stop once we have enough -------------------------------------
    console.log('Scanning Base Set for cards over $100...');
    const valuable: string[] = [];

    for await (const card of client.v2.cards.iterate({
      game: 'pokemon',
      set: 'base-set-pokemon',
      order_by: 'price',
      order: 'desc',
      limit: 50,
    })) {
      const price = card.variants[0]?.markets[0]?.price ?? 0;
      if (price < 100) break; // sorted desc, so the first sub-$100 card ends the useful range

      valuable.push(`${card.name} — $${price.toFixed(2)}`);
      if (valuable.length >= 10) break; // and we only want the top 10
    }

    valuable.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));

    // --- iteratePages, when you need usage or the page boundaries ---------------------------
    // The same walk, but yielding whole pages — handy for watching the quota as you go.
    let pages = 0;
    for await (const page of client.v2.cards.iteratePages({ game: 'pokemon', limit: 100 })) {
      pages++;
      console.log(`\nPage ${pages}: ${page.data.length} cards, ${page.usage.remaining} requests left`);
      if (pages >= 2) break;
    }

    // --- graded cards ----------------------------------------------------------------------
    // Graded slabs are ordinary variants discriminated by `type: 'graded'`, with a structured
    // `grading` object. `graded: 'include'` (raw + graded together) is only valid on a direct
    // lookup, and carries a cost surcharge.
    const search = await client.v2.cards.search('charizard', { game: 'pokemon', limit: 1 });
    const target = search.data[0];
    if (target) {
      const { data: card } = await client.v2.cards.retrieve(target.id, {
        graded: 'include',
        grading_company: 'PSA',
      });

      console.log(`\nGraded variants of ${card.name}:`);
      for (const variant of card.variants) {
        if (variant.type !== 'graded' || !variant.grading) continue;
        const price = variant.markets[0]?.price?.toFixed(2) ?? 'N/A';
        console.log(`  ${variant.grading.canonical} — $${price}`);
      }
    }
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

main();

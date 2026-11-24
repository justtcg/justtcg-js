import { JustTCG, V2Card } from '../src';

/**
 * Card facts on v2: `print_details` (how a Magic product is printed) and `include: ['gameplay']`
 * (format legality, artist and game facts), plus graded price expiry.
 *
 * - `print_details` is on every card by default. It is `null` outside Magic.
 * - `gameplay` only appears when you ask for it. `include` replaces the defaults, so list
 *   `periods` and `price_history` as well if you still want them.
 */
async function main() {
  try {
    const client = new JustTCG();

    // --- Magic: print details and gameplay ---------------------------------------------------
    const { data: magic } = await client.v2.cards.search('lightning bolt', {
      game: 'magic-the-gathering',
      include: ['periods', 'price_history', 'gameplay'],
      limit: 5,
    });

    for (const card of magic) {
      console.log(`\n${card.name} (${card.set.name ?? card.set.id})`);
      printDetails(card);
      printGameplay(card);
    }

    // --- Pokémon: gameplay alone, no periods or price history --------------------------------
    const { data: pokemon } = await client.v2.cards.search('mewtwo', {
      game: 'pokemon',
      include: ['gameplay'],
      limit: 1,
    });
    if (pokemon[0]) {
      console.log(`\n${pokemon[0].name}`);
      printGameplay(pokemon[0]);
      // Gameplay alone replaced the default periods, so there are none here.
      console.log(
        `  periods returned: ${Object.keys(pokemon[0].variants[0]?.markets[0]?.periods ?? {}).length}`,
      );
    }

    // --- graded price expiry -----------------------------------------------------------------
    // A graded price expires 90 days after the slab's most recent sale.
    const { data: graded } = await client.v2.cards.search('charizard', {
      game: 'pokemon',
      graded: 'only',
      grading_company: 'PSA',
      limit: 3,
    });
    console.log('\nGraded prices:');
    for (const card of graded) {
      for (const variant of card.variants) {
        const market = variant.markets[0];
        if (!market || !variant.grading) continue;
        const expires = market.price_expires_at
          ? new Date(market.price_expires_at * 1000).toISOString().slice(0, 10)
          : 'n/a';
        const price =
          market.price_status === 'expired'
            ? `expired (last $${market.last_price?.toFixed(2)})`
            : `$${market.price?.toFixed(2) ?? 'N/A'}`;
        console.log(`  ${card.name} ${variant.grading.canonical}: ${price}, expires ${expires}`);
      }
    }
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

function printDetails(card: V2Card) {
  const details = card.print_details;
  if (!details) return;
  const treatments =
    details.treatments.length > 0 ? details.treatments.join(', ') : 'regular frame';
  console.log(`  printing: ${treatments}${details.style ? ` (${details.style})` : ''}`);
  console.log(
    `  foil: ${details.foil_type ?? 'no foil printing'}; finishes: ${details.finishes.join(', ')}`,
  );
  if (details.serialized) console.log('  serial-numbered');
}

function printGameplay(card: V2Card) {
  const gameplay = card.gameplay;
  if (!gameplay) {
    console.log('  no gameplay data');
    return;
  }
  const legal = Object.entries(gameplay.legalities ?? {})
    .filter(([, status]) => status === 'legal')
    .map(([format]) => format);
  console.log(`  artist: ${gameplay.artist ?? 'unknown'}; legal in: ${legal.join(', ') || 'none'}`);

  // `source` selects the shape of `facts`.
  if (gameplay.source === 'mtgjson') {
    const { mana_cost, mana_value, types } = gameplay.facts;
    console.log(`  ${mana_cost ?? ''} (MV ${mana_value ?? 0}) ${types?.join(' ') ?? ''}`);
  } else {
    const { hp, types, stage, retreat } = gameplay.facts;
    console.log(
      `  ${stage ?? ''} ${types?.join('/') ?? ''}, HP ${hp ?? '?'}, retreat ${retreat ?? 0}`,
    );
  }
}

main();

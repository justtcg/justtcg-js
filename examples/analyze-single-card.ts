import { ConditionAbv, JustTCG } from '../src';

/**
 * This script demonstrates how to do a deep-dive on a single card,
 * retrieving all of its variants and their detailed pricing statistics.
 */
async function analyzeCard() {
  try {
    const client = new JustTCG();
    // const client = new JustTCG({ apiKey: 'your_api_key_here' }); // Or provide it directly

    // TCGplayer ID for "Shining Charizard"
    const tcgplayerId = '89163';
    const condition = ['NM', 'LP'] as ConditionAbv[]; // Include Near Mint and Lightly Played conditions only
    const printing = ["Unlimited Holofoil"];

    console.log(`Fetching detailed data for TCGplayer ID: ${tcgplayerId}...`);

    const response = await client.v1.cards.get({ tcgplayerId, condition, printing });

    if (response.data.length === 0) {
      console.log('Card not found.');
      return;
    }

    const card = response.data[0];
    console.log(`\n--- Analysis for: ${card.name} (${card.set}) ---`);

    for (const variant of card.variants) {
      const price = variant.price?.toFixed(2) ?? 'N/A';
      const printing = variant.printing ?? 'Normal';
      const change7d = variant.priceChange7d?.toFixed(2) ?? 'N/A';

      console.log(`\n  Variant: ${printing} (${variant.condition})`);
      console.log(`  > Current Price: $${price}`);
      console.log(`  > 7-Day Change: ${change7d}%`);
    }

    console.log(`\nAPI requests remaining: ${response.usage.apiRequestsRemaining}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

analyzeCard();

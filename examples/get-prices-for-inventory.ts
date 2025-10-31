import { ConditionAbv, JustTCG } from '../src';

/**
 * This script demonstrates how to fetch the latest prices for a list of
 * items in a store's inventory using the efficient `getByBatch` method.
 */
async function updateInventoryPrices() {
  try {
    const client = new JustTCG();
    // const client = new JustTCG({ apiKey: 'your_api_key_here' }); // Or provide it directly

    // Imagine this is your store's inventory. You can look up items
    // using different identifiers in the same request.
    const inventoryItems = [
      { tcgplayerId: '89163', condition: ['NM'] as ConditionAbv[] }, // Shining Charizard
      { cardId: 'pokemon-japan-s10b-pokemon-go-metal-energy-mirror-holofoil' },
      { variantId: 'magic-the-gathering-collector-s-edition-black-lotus-ce-rare_near-mint' },
      { tcgplayerSkuId: '8695915' },
      { scryfallId: 'f150d6e9-3da6-4655-9c63-dd34525d08a1' },
      { mtgjsonId: 'aaef9ad6-eb1a-5195-b6af-64de9659f881', condition: ['NM'] as ConditionAbv[] }
    ];

    console.log(`Fetching prices for ${inventoryItems.length} inventory items...`);

    const response = await client.v1.cards.getByBatch(inventoryItems);

    console.log('\n--- Latest Market Prices ---');
    for (const card of response.data) {
      const price = card.variants[0]?.price?.toFixed(2) ?? 'N/A';
      console.log(`- ${card.name} (${card.set}): $${price}`);
    }

    console.log(`\nAPI requests remaining: ${response.usage.apiRequestsRemaining}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

updateInventoryPrices();

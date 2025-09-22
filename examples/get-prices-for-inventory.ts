import { JustTCG } from '../src';

/**
 * This script demonstrates how to fetch the latest prices for a list of
 * items in a store's inventory using the efficient `getByBatch` method.
 */
async function updateInventoryPrices() {
  try {
    const client = new JustTCG();

    // Imagine this is your store's inventory. You can look up items
    // using different identifiers in the same request.
    const inventoryItems = [
      { tcgplayerId: '89163' }, // Shining Charizard
      { cardId: 'pokemon-japan-s10b-pokemon-go-metal-energy-mirror-holofoil' },
      { variantId: 'magic-the-gathering-collector-s-edition-black-lotus-ce-rare_near-mint' },
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
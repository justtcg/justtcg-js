import { JustTCG } from '../src';

// This example finds the top 10 most valuable cards from Disney Lorcana's "The First Chapter"

async function findTopCards() {
  try {
    console.log('Initializing JustTCG Client...');
    const client = new JustTCG(); // Assumes JUSTTCG_API_KEY is in your environment
    // const client = new JustTCG({ apiKey: 'your_api_key_here' }); // Or provide it directly

    const game = 'Disney Lorcana';
    const set = 'The First Chapter';

    console.log(`Searching for the most valuable cards in ${game}: ${set}...`);

    const response = await client.v1.cards.get({
      game,
      set,
      orderBy: 'price', // Sort by the market price
      order: 'desc', // In descending order
      limit: 10, // Get the top 10
    });

    console.log('\n--- Top 10 Most Valuable Cards ---');
    response.data.forEach((card, index) => {
      // Find the most expensive variant for display (e.g., the Foil version)
      const topVariant = card.variants.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];

      const price = topVariant?.price?.toFixed(2) ?? 'N/A';
      const printing = topVariant?.printing ? `(${topVariant.printing})` : '';

      console.log(`${index + 1}. ${card.name} ${printing} - $${price}`);
    });

    console.log(`\nAPI requests remaining: ${response.usage.apiRequestsRemaining}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

findTopCards();

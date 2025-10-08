import { JustTCG, SearchCardsOptions } from '../src';

/**
 * ==================================================================
 * ADJUST YOUR SEARCH PARAMETERS HERE
 * ==================================================================
 */

const SEARCH_QUERY = 'Eevee'; // The card name you want to search for.
const GAME = 'Pokemon'; // Optional: The game to filter by (e.g., 'Pokemon', 'Disney Lorcana').
const SET = undefined; // Optional: The specific set Id to filter by (e.g., 'base-set-pokemon').
const LIMIT = 20; // The maximum number of cards to return.

/**
 * ==================================================================
 */

/**
 * This script demonstrates a flexible search using the `search` helper method.
 * A developer can easily change the constants at the top of the file to
 * experiment with different search combinations.
 */
async function dynamicSearch() {
  try {
    const client = new JustTCG(); // Assumes JUSTTCG_API_KEY is in your environment
    // const client = new JustTCG({ apiKey: 'your_api_key_here' }); // Or provide it directly

    console.log(`Searching for cards with query: "${SEARCH_QUERY}"...`);

    // The search options are built dynamically from the constants above.
    // Undefined values will be ignored by the SDK.
    const searchOptions: SearchCardsOptions = {
      game: GAME,
      set: SET,
      limit: LIMIT,
      condition: ['NM', 'LP', 'HP', 'MP', "DMG"], // Exclude sealed products
      include_price_history: false,
      include_statistics: ['7d']
    };

    const response = await client.v1.cards.search(SEARCH_QUERY, searchOptions);

    if (response.data.length === 0) {
      console.log('No cards found matching your criteria.');
      return;
    }

    console.log(
      `\n--- Found ${response.pagination?.total} results (showing first ${response.data.length}) ---`,
    );

    for (const card of response.data) {
      const price = card.variants[0]?.price?.toFixed(2) ?? 'N/A';
      console.log(`- ${card.name} | ${card.variants[0]?.condition} | Set: ${card.set_name} | Game: ${card.game} | Price: $${price}`);
    }

    console.log(`\nAPI requests remaining: ${response.usage.apiRequestsRemaining}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

dynamicSearch();

import { JustTCG } from '../src';

/**
 * This script demonstrates how to use the `fetchAll` helper method
 * to easily iterate over a large, paginated list of resources,
 * such as all Pokémon sets ever released.
 */
async function listAllSets() {
  try {
    const client = new JustTCG();
    let setCount = 0;

    console.log('Fetching all Pokémon sets (this may take a moment)...');

    // The for-await-of loop works with our async generator, handling
    // all the pagination API calls for you in the background.
    for await (const set of client.v1.sets.fetchAll({ game: 'Pokemon' })) {
      console.log(`- ${set.name} (id: ${set.id ?? 'N/A'})`);
      setCount++;
    }

    console.log(`\nFound a total of ${setCount} sets.`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

listAllSets();

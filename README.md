# JustTCG JS/TS SDK

[![NPM Version](https://img.shields.io/npm/v/justtcg-js.svg)](https://www.npmjs.com/package/justtcg-js)
[![Build Status](https://img.shields.io/github/actions/workflow/status/justtcg/justtcg-js/ci.yml?branch=main)](https://github.com/justtcg/justtcg-js/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official JavaScript/TypeScript SDK for the JustTCG API. Access real-time and historical pricing data for the world's most popular Trading Card Games.

## Features

-   **✅ Modern & Type-Safe:** Written entirely in TypeScript for a superior developer experience with static typing and autocomplete.
-   **🔐 Versioned API Access:** Clean, explicit access to API versions, starting with `v1`, ensuring your integrations are stable and future-proof.
-   **🧼 Clean Data Models:** Raw API responses are automatically transformed into clean, intuitive JavaScript objects (e.g., prices in dollars, camelCase properties).
-   **🚨 Robust Error Handling:** Predictable, typed errors allow you to gracefully handle API issues like invalid keys or rate limits.
-   **🚀 Zero Dependencies:** A lightweight package with no production dependencies for fast and secure installation.
-   **🤖 Node.js First:** Optimized for server-side environments, with support for environment variable authentication out of the box.

## Installation

```bash
npm install justtcg-js
````

## Quick Start

Get your API key from your [JustTCG Dashboard](https://justtcg.com/dashboard). For security, we recommend storing your API key in an environment variable.

```typescript
import { JustTCG } from 'justtcg-js';

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

```

# Examples

You can find practical, runnable examples in the `/examples` directory of this repository.

To run an example, first ensure you have set your `JUSTTCG_API_KEY` environment variable.

```bash
# Example: Find the most valuable Lorcana cards from The First Chapter
export JUSTTCG_API_KEY="YOUR_API_KEY_HERE"
npx ts-node examples/find-most-valuable-lorcana-cards.ts
```

## API Reference

The client is organized by API version, resource, and method. The structure is always:

`client.[version].[resource].[method](params)`

- `client.v1.games`
  - `.list()`: Fetches all supported games.
- `client.v1.sets`
  - `.list(params)`: Fetches a paginated list of sets.
  - `.fetchAll(params)`: (Helper) Fetches all sets for a game, handling pagination automatically.
- `client.v1.cards`
  - `.get(params)`: Fetches cards with powerful search and filter parameters.
  - `.getByBatch(items)`: Fetches multiple specific cards in a single request.

For a full list of methods and parameters, please see our complete [API Documentation](https://justtcg.com/docs).

## Contributing

We welcome contributions\! Please see our CONTRIBUTING.md for details on how to get started.

## License

This SDK is licensed under the [MIT License](./LICENSE).
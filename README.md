# JustTCG JS/TS SDK

[![NPM Version](https://img.shields.io/npm/v/justtcg-js.svg)](https://www.npmjs.com/package/justtcg-js)
[![Build Status](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/justtcg-js/ci.yml?branch=main)](https://github.com/YOUR_USERNAME/justtcg-js/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official, developer-friendly JavaScript/TypeScript SDK for the JustTCG API. Access real-time and historical pricing data for the world's most popular Trading Card Games.

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
import { JustTCG, JustTCGAuthenticationError } from 'justtcg-js';

// The client automatically looks for the JUSTTCG_API_KEY environment variable.
// You can also pass it in directly: new JustTCG({ apiKey: '...' })
const client = new JustTCG();

async function getCardData() {
  try {
    // Example 1: Search for cards across all games
    console.log('--- Searching for "Pikachu" cards ---');
    const searchResult = await client.v1.cards.search({
      query: 'Pikachu',
      limit: 5,
    });

    console.log(`Found ${searchResult.pagination.total} cards. Showing the first ${searchResult.data.length}.`);
    // Print the name and price of the first variant of the first card
    for (const card of searchResult.data) {
        const firstVariantPrice = card.variants[0]?.price ?? 'N/A';
        console.log(`- ${card.name} (${card.set}): $${firstVariantPrice}`);
    }

    console.log('\nAPI Requests Remaining:', searchResult.usage.apiRequestsRemaining);


    // Example 2: Get a list of all supported games
    console.log('\n--- Fetching all supported games ---');
    const gamesResult = await client.v1.games.list();
    console.log('Supported Games:', gamesResult.data.map(g => g.name).join(', '));

  } catch (error) {
    if (error instanceof JustTCGAuthenticationError) {
      console.error('Authentication failed. Please check your API key.');
    } else {
      console.error('An API error occurred:', error.message);
    }
  }
}

getCardData();

```

## Usage

The client is organized by API version, resource, and method. The structure is always:

`client.[version].[resource].[method](params)`

For example:

  - `client.v1.games.list()`
  - `client.v1.sets.list({ game: 'Lorcana' })`
  - `client.v1.cards.getByIds(['card-id-1', 'card-id-2'])`

For a full list of methods and parameters, please see our complete [API Documentation](https://justtcg.com/docs).

## Contributing

We welcome contributions\! Please see our CONTRIBUTING.md for details on how to get started.

## License

This SDK is licensed under the [MIT License](./LICENSE).
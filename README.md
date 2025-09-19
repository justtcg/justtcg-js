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

const client = new JustTCG();

async function getPokemonSets() {
  console.log('Fetching all Pokémon sets...');
  
  // The fetchAll helper handles pagination for you automatically!
  for await (const set of client.v1.sets.fetchAll({ game: 'Pokemon' })) {
    console.log(`- ${set.name} (Released: ${set.releaseDate ?? 'N/A'})`);
  }
}

getPokemonSets().catch(error => {
  console.error('An error occurred:', error.message);
});

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

For example:

  - `client.v1.games.list()`
  - `client.v1.sets.list({ game: 'Lorcana' })`
  - `client.v1.cards.getByIds(['card-id-1', 'card-id-2'])`

For a full list of methods and parameters, please see our complete [API Documentation](https://justtcg.com/docs).

## Contributing

We welcome contributions\! Please see our CONTRIBUTING.md for details on how to get started.

## License

This SDK is licensed under the [MIT License](./LICENSE).
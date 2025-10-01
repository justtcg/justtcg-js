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
```

## Quick Start

Get your API key from your [JustTCG Dashboard](https://justtcg.com/dashboard). For security, we recommend storing your API key in an environment variable named `JUSTTCG_API_KEY`.

```typescript
import { JustTCG } from 'justtcg-js';

async function findTopCards() {
  try {
    // The client automatically looks for the JUSTTCG_API_KEY environment variable
    const client = new JustTCG();

    // Or, you can provide the key directly in the constructor
    // const client = new JustTCG({ apiKey: 'your_api_key_here' });

    console.log(`Searching for the most valuable cards in Disney Lorcana: The First Chapter...`);

    const response = await client.v1.cards.get({
      game: 'Disney Lorcana',
      set: 'the-first-chapter-disney-lorcana',
      orderBy: 'price',
      order: 'desc',
      limit: 10,
    });

    console.log('\n--- Top 10 Most Valuable Cards ---');
    response.data.forEach((card, index) => {
      // Find the most expensive variant for display (e.g., the Foil version)
      const topVariant = card.variants.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];

      const price = topVariant?.price?.toFixed(2) ?? 'N/A';
      const printing = topVariant?.printing ? `(${topVariant.printing})` : '';

      console.log(`${index + 1}. ${card.name} ${printing} - $${price}`);
    });

    console.log(`\nAPI requests remaining today: ${response.usage.apiDailyRequestsRemaining}`);
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    process.exit(1);
  }
}

findTopCards();
```

## The Response Object

All successful method calls from the client return a consistent `JustTCGApiResponse` object. It's crucial to understand its structure.

```typescript
interface JustTCGApiResponse<T> {
  /** The main data payload from the API. The type of T depends on the method called. */
  data: T;

  /** Pagination metadata, ONLY present on paginated endpoints like `cards.get()` and `sets.list()`. */
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  /** API usage metadata, included in every successful response. */
  usage: {
    apiRequestLimit: number;
    apiDailyLimit: number;
    apiRateLimit: number;
    apiRequestsUsed: number;
    apiDailyRequestsUsed: number;
    apiRequestsRemaining: number;
    apiDailyRequestsRemaining: number;
    apiPlan: string;
  };

  /** If the API returns an error (e.g., validation), this field will contain the message. */
  error?: string;

  /** An error code corresponding to the error message. */
  code?: string;
}
```

## API Reference

The client is organized by API version, resource, and method. The structure is always:
**`client.[version].[resource].[method](params)`**.

### `v1.games`

#### **`.list()`**

Fetches a list of all supported Trading Card Games.

-   **Parameters:** None.
    
-   **Returns:** `Promise<JustTCGApiResponse<Game[]>>`
    

**Response `data` Object (`Game`):**

```typescript
{
  id: string; // The unique identifier for the game (e.g., 'pokemon')
  name: string; // The full name of the game (e.g., 'Pokemon')
  cards_count: number; // Total number of cards in the game
  sets_count: number; // Total number of sets in the game
}

```

### `v1.sets`

#### **`.list(params)`**

Fetches a list of sets, which **must be filtered by game**.

-   Parameters:
    | Parameter | Type   | Required | Description                                               |
    | :-------- | :----- | :------- | :-------------------------------------------------------- |
    | game      | string | Yes      | The name of the game to filter sets by (e.g., 'Pokemon'). |
    
-   **Returns:** `Promise<JustTCGApiResponse<Set[]>>` (This response includes the `pagination` object).
    
**Response `data` Object (`Set`):**

```typescript
{
  id: string; // The unique identifier for the set
  name: string; // The name of the set (e.g., 'Base Set')
  count: number; // The number of cards in the set
  gameId: string; // The ID of the game this set belongs to
}
```

### `v1.cards`

#### **`.get(params)`**

A powerful and flexible method to browse, filter, and retrieve a paginated list of cards.

 | Parameter   | Type                                       | Description                                                                                                                                                                                                                                                       |
 | :---------- | :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 | game        | string                                     | The name of the game to filter by (e.g., 'Pokemon').                                                                                                                                                                                                              |
 | set         | string                                     | The id of the set to filter by (e.g., 'the-first-chapter-disney-lorcana').                                                                                                                                                                                        |
 | condition   | string[]                                   | An array of conditions to filter by. (e.g., ['NM', 'LP']). Valid values: "NM", "LP", "MP", "HP", "D".                                                                                                                                                             |
 | printing    | string[]                                   | An array of print types to filter by (e.g., ['Foil', '1st Edition']).                                                                                                                                                                                             |
 | orderBy     | 'price' \| '24h' \| '7d' \| '30d' \| '90d' | The field to sort the results by. Default is 'price'.                                                                                                                                                                                                             |
 | order       | 'asc' \| 'desc'                            | The sort order. Default is 'desc'.                                                                                                                                                                                                                                |
 | limit       | number                                     | The maximum number of results to return. Default is 20. <table><tr><th>Plan</th><th>Max</th></tr><tr><td>Free</td><td>20</td></tr><tr><td>Starter</td><td>100</td></tr><tr><td>Professional</td><td>100</td></tr><tr><td>Enterprise</td><td>200</td></tr></table> |
 | offset      | number                                     | The number of results to skip for pagination.                                                                                                                                                                                                                     |
 | tcgplayerId | string                                     | A specific TCGplayer product ID to look up.                                                                                                                                                                                                                       |
 | cardId      | string                                     | A specific JustTCG card ID to look up.                                                                                                                                                                                                                            |
 | variantId   | string                                     | A specific JustTCG variant ID to look up.                                                                                                                                                                                                                         |
    
-   **Returns:** `Promise<JustTCGApiResponse<Card[]>>` (This response includes the `pagination` object).

#### **`.getByBatch(items)`**

Retrieves multiple specific cards and their variants in a single, efficient request. This is ideal for updating inventory prices.

- Parameters: An array of `BatchLookupItem` objects.
    
| Parameter | Type              |                                                                                             Max Object Length                                                                                             | Description                 |
| :-------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------- |
| items     | BatchLookupItem[] | <table><tr><th>Plan</th><th>Max</th></tr><tr><td>Free</td><td>20</td></tr><tr><td>Starter</td><td>100</td></tr><tr><td>Professional</td><td>100</td></tr><tr><td>Enterprise</td><td>200</td></tr></table> | An array of lookup objects. |
    
**`BatchLookupItem` Object:**

You can mix and match different identifier types in a single batch request. The lookup item must define one of the following values: `cardId`, `variantId`, or `tcgplayerId`.
```typescript
{
  cardId?: string;      // A JustTCG card ID.
  variantId?: string;   // A JustTCG variant ID.
  tcgplayerId?: string; // A TCGplayer product ID.
  printing?: string[];  // Optional: Filter by specific print types for this item.
  condition?: string[]; // Optional: Filter by specific conditions for this item.
}
```
-   **Returns:** `Promise<JustTCGApiResponse<Card[]>>` (This response does **not** include the `pagination` object).

#### **Response `data` Object (`Card` and `Variant`)**

The `get()` and `getByBatch()` methods return an array of `Card` objects. Each card contains an array of its `Variant` objects.

**`Card` Object:**
```typescript
{
  /** The unique identifier for the card. */
  id: string;
  /** The name of the card. */
  name: string;
  /** The game this card belongs to. */
  game: string;
  /** The set ID this card belongs to. */
  set: string;
  /** The set name this card belongs to. */
  set_name: string;
  /** The card number within the set. */
  number: string | null;
  /** The rarity of the card. */
  rarity: string | null;
  /** The TCGPlayer ID for the card. */
  tcgplayerId: string | null;
  /** Additional details about the card. */
  details?: string | null;
  /** The different variants of the card. */
  variants: Variant[];
}
```
**`Variant` Object:** (Contains detailed pricing)
```typescript
{
  /** The unique identifier for this variant. */
  id: string;
  /** The condition of the card variant (e.g., Near Mint). */
  condition: string;
  /** The printing type of the card variant (e.g., Foil, 1st Edition). */
  printing: string;
  /** The language of the card variant, if applicable. */
  language: string | null;
  /** The current price of the card variant in dollars. */
  price: number;
  /** The last time the price was updated, as an epoch timestamp in seconds. */
  lastUpdated: number; // Epoch seconds
  /** The percentage change in price over the last 24 hours. */
  priceChange24hr?: number | null; // Percentage

  // --- 7d stats ---
  /** The percentage change in price over the last 7 days. */
  priceChange7d?: number | null; // Percentage
  /** The average price over the last 7 days. */
  avgPrice?: number | null; // Dollars
  /** The price history entries over the last 7 days. */
  priceHistory?: PriceHistoryEntry[] | null;
  minPrice7d?: number | null; // Dollars
  maxPrice7d?: number | null; // Dollars
  stddevPopPrice7d?: number | null;
  covPrice7d?: number | null;
  iqrPrice7d?: number | null;
  trendSlope7d?: number | null;
  priceChangesCount7d?: number | null;

  // --- 30d stats ---
  priceChange30d?: number | null; // Percentage
  avgPrice30d?: number | null; // Dollars
  minPrice30d?: number | null; // Dollars
  maxPrice30d?: number | null; // Dollars
  priceHistory30d?: PriceHistoryEntry[] | null;
  stddevPopPrice30d?: number | null;
  covPrice30d?: number | null;
  iqrPrice30d?: number | null;
  trendSlope30d?: number | null;
  priceChangesCount30d?: number | null;
  priceRelativeTo30dRange?: number | null;

  // --- 90d stats ---
  priceChange90d?: number | null; // Percentage
  avgPrice90d?: number | null; // Dollars
  minPrice90d?: number | null; // Dollars
  maxPrice90d?: number | null; // Dollars
  stddevPopPrice90d?: number | null;
  covPrice90d?: number | null;
  iqrPrice90d?: number | null;
  trendSlope90d?: number | null;
  priceChangesCount90d?: number | null;
  priceRelativeTo90dRange?: number | null;

  // --- 1y stats ---
  minPrice1y?: number | null;
  maxPrice1y?: number | null;

  // --- All-time stats ---
  minPriceAllTime?: number | null;
  minPriceAllTimeDate?: string | null;
  maxPriceAllTime?: number | null;
  maxPriceAllTimeDate?: string | null;
}
```
**`PriceHistoryEntry` Object:**
```typescript
{
  /** Epoch timestamp in seconds. */
  t: number;
  /** Price in dollars. */
  p: number;
}
```

## Error Handling

The SDK surfaces errors in two primary ways: **thrown exceptions** for critical SDK issues and an **`error` property** on the response object for API issues.

### 1. Thrown Exceptions (SDK-level Errors)

Critical errors that happen at the SDK level will be thrown as a JavaScript `Error`. These **must** be wrapped in a `try...catch` block.

**Common Causes:**
    
-   **Authentication Failure (401):** The API key is missing.
-   **Invalid Parameter Value:** Providing an unknown value for a parameter like `orderBy`.

**Example:**
```typescript
try {
  const client = new JustTCG();
  await client.v1.games.list();
} catch (error) {
  // This block will catch the error
  console.error((error as Error).message); // e.g., "Authentication error: API key is missing."
}
```

### 2. Response `error` Property (API-level Errors)

If a request is syntactically valid but fails API-level validation (e.g., an invalid lookup parameter), the API will often return a normal response object where the `data` is empty and the `error` and `code` properties are populated.

**Common Causes:**
-   **Authentication Failure (401/403):** The provided API key is invalid or disabled.
-   **Not Found (404):** The requested endpoint does not exist.
-   **Rate Limit Exceeded (429):** Your application is making too many requests.
-   **Missing Required Parameters:** Calling `client.v1.sets.list()` without the required `game` parameter.
-   **Invalid Lookup Parameter:** Providing an unknown value for a parameter like `cardId`.
    
**Example:**
```typescript
const client = new JustTCG();
// Missing the required 'game' parameter
const response = await client.v1.sets.list();

if (response.error) {
  // This block will execute
  console.log(response.error); // "Required query parameter \"game\" is missing"
  console.log(response.code);  // "INVALID_REQUEST"
} else {
  // This data will be empty
  console.log(response.data);
}
```

## Examples

You can find practical, runnable examples in the `/examples` directory of this repository.

To run an example, first ensure you have set your `JUSTTCG_API_KEY` environment variable.
```bash
# Example: Find the most valuable Lorcana cards from The First Chapter
export JUSTTCG_API_KEY="YOUR_API_KEY_HERE"
npx ts-node examples/find-most-valuable-lorcana-cards.ts
```

## License

This SDK is licensed under the [MIT License](./LICENSE).

/**
 * Represents a single Trading Card Game.
 */
export interface Game {
  id: string;
  name: string;
}

/**
 * Represents a single Card Set within a Game.
 */
export interface Set {
  id: string;
  name: string;
  gameId: string;
}

/**
 * Pagination metadata included in paginated API responses.
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * API usage metadata returned in every successful API response.
 */
export interface UsageMeta {
  apiRequestLimit: number;
  apiRequestsRemaining: number;
  apiRequestsUsed: number;
  apiPlan: string;
}

/**
 * The structured, clean response object our SDK provides.
 */
export interface JustTCGApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
  usage: UsageMeta;
}

/**
 * A single entry in a variant's price history.
 */
export interface PriceHistoryEntry {
  t: number; // Date epoch in seconds
  p: number; // Price in USD
}

/**
 * Represents a specific version of a card (e.g., Near Mint, 1st Edition Foil).
 * Contains detailed pricing and statistical data.
 */
export interface VariantWithPrice {
  id: string;
  condition: string | null;
  printing: string | null;
  language: string | null;
  price: number | null;
  lastUpdated: number | null; // Epoch seconds
  priceChange24hr?: number | null; // Percentage

  // --- 7d stats ---
  priceChange7d?: number | null; // Percentage
  avgPrice?: number | null; // Dollars
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

/**
 * Represents a single trading card, which contains one or more variants.
 */
export interface Card {
  id: string;
  name: string;
  game: string;
  set: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  details?: string | null;
  variants: VariantWithPrice[];
}

import { QueryParams } from '../core/http-client';

/**
 * Represents a single Trading Card Game.
 */
export interface Game {
  /** The id of this game. */
  id: string;
  /** The name of this game. */
  name: string;
  /** The total number of cards in this game. */
  cards_count: number;
  /** The total number of sets in this game. */
  sets_count: number;
}

/**
 * Represents a single Card Set within a Game.
 */
export interface Set {
  /** The id of this set. */
  id: string;
  /** The name of this set. */
  name: string;
  /** The number of cards in this set. */
  count: number;
  /** The id of the game this set belongs to. */
  gameId: string;
}

/**
 * Parameters for the GET /cards endpoint.
 */
export interface GetCardsParams extends QueryParams {
  /** A TCGplayer product ID. */
  tcgplayerId?: string;
  /** A JustTCG card ID. */
  cardId?: string;
  /** A JustTCG variant ID. */
  variantId?: string;
  /** A general search query for the card's name. */
  query?: string;
  /** The name of the game (e.g., 'Pokemon'). */
  game?: string;
  /** The id of the set (e.g., 'base-set-pokemon'). */
  set?: string;
  /** The name of the set (e.g., 'Base Set'). */
  set_name?: string;
  /** An array of card conditions to filter by (e.g., ['Near Mint', 'Lightly Played']). */
  condition?: string[];
  /** An array of card print types to filter by (e.g., ['Foil', '1st Edition']). */
  printing?: string[];
  /** The maximum number of results to return. Default is 20. */
  limit?: number;
  /** The number of results to skip for pagination. */
  offset?: number;
  /** The order to sort the results by. Can be 'asc' or 'desc'. Default is 'desc'. */
  order?: 'asc' | 'desc';
  /** The field to order the results by. Default is 'price'. */
  orderBy?: 'price' | '24h' | '7d' | '30d' | '90d';
}

/**
 * Pagination metadata included in paginated API responses.
 */
export interface PaginationMeta {
  /** The total number of items available for this query. */
  total: number;
  /** The maximum number of items returned per page. */
  limit: number;
  /** The number of items skipped before starting to collect the result set. */
  offset: number;
  /** Indicates if there are more items to fetch beyond the current page. */
  hasMore: boolean;
}

/**
 * API usage metadata returned in every successful API response.
 */
export interface UsageMeta {
  /** The maximum number of API requests allowed per billing cycle. */
  apiRequestLimit: number;
  /** The maximum number of API requests allowed per day. */
  apiDailyLimit: number;
  /** The maximum number of API requests allowed per minute. */
  apiRateLimit: number;
  /** The number of API requests used in the current billing cycle. */
  apiRequestsUsed: number;
  /** The number of API requests used today. */
  apiDailyRequestsUsed: number;
  /** The number of API requests remaining in the current billing cycle. */
  apiRequestsRemaining: number;
  /** The number of API requests remaining today. */
  apiDailyRequestsRemaining: number;
  /** The API plan name. */
  apiPlan: string;
}

/**
 * The structured, clean response object our SDK provides.
 */
export interface JustTCGApiResponse<T> {
  /** The main data payload from the API. */
  data: T;
  /** Pagination metadata, if the response is paginated. */
  pagination?: PaginationMeta;
  /** API usage metadata. */
  usage: UsageMeta;
  /** Error message, if the request failed. */
  error?: string;
  /** Error code, if the request failed. */
  code?: string;
}

/**
 * A single entry in a variant's price history.
 */
export interface PriceHistoryEntry {
  /** Epoch timestamp in seconds. */
  t: number;
  /** Price in dollars. */
  p: number;
}

/**
 * Represents a specific version of a card (e.g., Near Mint, 1st Edition Foil).
 * Contains detailed pricing and statistical data.
 */
export interface Variant {
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

/**
 * Represents a single trading card, which contains one or more variants.
 */
export interface Card {
  /** The unique identifier for the card. */
  id: string;
  /** The name of the card. */
  name: string;
  /** The game this card belongs to. */
  game: string;
  /** The set this card belongs to. */
  set: string;
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

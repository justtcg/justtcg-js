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
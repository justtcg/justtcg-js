import { handleResponse } from '../../core/response-handler';
import { Card, GetCardsParams, JustTCGApiResponse, PaginationMeta, UsageMeta } from '../../types';
import { BaseResource } from './base';

/**
 * Describes a single item for a batch lookup request.
 */
export interface BatchLookupItem {
  /** A TCGplayer product ID. */
  tcgplayerId?: string;
  /** A JustTCG card ID. */
  cardId?: string;
  /** A JustTCG variant ID. */
  variantId?: string;
  /** An array of card print types to filter by. */
  printing?: string[];
  /** An array of card conditions to filter by. */
  condition?: string[];
}

/**
 * Optional parameters for the `search` method.
 */
export interface SearchCardsOptions {
  /** The name of the game to filter by (e.g., 'Pokemon'). */
  game?: string;
  /** The name of the set to filter by (e.g., 'Base Set'). */
  set?: string;
  /** The maximum number of results to return. Default is 20. */
  limit?: number;
  /** The number of results to skip for pagination. */
  offset?: number;
}

interface RawCardsApiResponse {
  data: Card[];
  meta?: PaginationMeta;
  _metadata: UsageMeta;
}

/**
 * Provides access to the /cards API resource.
 */
export class CardsResource extends BaseResource {
  /**
   * Retrieves a paginated list of cards based on a flexible set of query parameters.
   * @param params Parameters for searching, filtering, and paginating cards.
   * @returns A Promise resolving to the JustTCG API response containing an array of Card objects.
   */
  public async get(params: GetCardsParams): Promise<JustTCGApiResponse<Card[]>> {
    const rawResponse = await this._get<RawCardsApiResponse>('/cards', params);
    return handleResponse(rawResponse);
  }

  /**
   * Retrieves a list of cards based on a batch of specific identifiers.
   * @param items An array of objects, each identifying a card to look up.
   * @returns A Promise resolving to the JustTCG API response containing an array of the requested Card objects.
   */
  public async getByBatch(items: BatchLookupItem[]): Promise<JustTCGApiResponse<Card[]>> {
    const rawResponse = await this._post<RawCardsApiResponse>('/cards', items);
    return handleResponse(rawResponse);
  }

  /**
   * A convenience method to search for cards by a query string.
   * This is a wrapper around the more flexible `get` method.
   * @param query A search query for the card's name.
   * @param options Optional parameters to filter or paginate the search results.
   * @returns A Promise resolving to the JustTCG API response containing an array of Card objects.
   */
  public async search(
    query: string,
    options?: SearchCardsOptions,
  ): Promise<JustTCGApiResponse<Card[]>> {
    // This helper calls our powerful 'get' method with a simplified set of options.
    const params: GetCardsParams = {
      query,
      ...options,
    };
    return this.get(params);
  }
}

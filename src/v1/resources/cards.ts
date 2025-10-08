import { handleResponse } from '../../core/response-handler';
import { BatchLookupItem, Card, GetCardsParams, JustTCGApiResponse, PaginationMeta, SearchCardsOptions, UsageMeta } from '../../types';
import { BaseResource } from './base';

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

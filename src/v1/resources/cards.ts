import { handleResponse } from '../../core/response-handler';
import { QueryParams } from '../../core/http-client';
import { Card, JustTCGApiResponse, PaginationMeta, UsageMeta } from '../../types';
import { BaseResource } from './base';

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
  /** The name of the set (e.g., 'Base Set'). */
  set?: string;
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

interface BatchLookupBody {
  batchLookups: BatchLookupItem[];
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
    const body: BatchLookupBody = { batchLookups: items };
    const rawResponse = await this._post<RawCardsApiResponse>('/cards', body);
    return handleResponse(rawResponse);
  }
}

// src/v1/resources/cards.ts

import { handleResponse } from '../../core/response-handler';
import { HttpClient, QueryParams } from '../../core/http-client';
import { Card, JustTCGApiResponse, PaginationMeta, UsageMeta } from '../../types';

// Define the specific parameters for the GET /cards endpoint
// This is based on the `ValidatedParams` from your backend types
export interface GetCardsParams extends QueryParams {
  tcgplayerId?: string;
  cardId?: string;
  variantId?: string;
  query?: string;
  game?: string;
  set?: string;
  condition?: string[];
  printing?: string[];
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  orderBy?: string; // Add specific orderBy options if available
}

export interface BatchLookupItem {
  tcgplayerId?: string;
  cardId?: string;
  variantId?: string;
  printing?: string[];
  condition?: string[];
}

interface BatchLookupBody {
  batchLookups: BatchLookupItem[];
}

// Define the specific shape of the raw response for this endpoint
interface RawCardsApiResponse {
  data: Card[];
  meta: PaginationMeta;
  _metadata: UsageMeta;
}

export class CardsResource {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Retrieves a paginated list of cards based on a flexible set of query parameters.
   * @param params Parameters for searching, filtering, and paginating cards.
   * @returns A JustTCG API response containing an array of Card objects.
   */
  public async get(params: GetCardsParams): Promise<JustTCGApiResponse<Card[]>> {
    const rawResponse = await this.httpClient.get<RawCardsApiResponse>('/cards', params);
    return handleResponse(rawResponse);
  }

    /**
   * Retrieves a list of cards based on a batch of specific identifiers.
   * @param items An array of objects, each identifying a card to look up.
   * @returns A JustTCG API response containing an array of the requested Card objects.
   */
  public async getByBatch(items: BatchLookupItem[]): Promise<JustTCGApiResponse<Card[]>> {
    const body: BatchLookupBody = { batchLookups: items };
    const rawResponse = await this.httpClient.post<RawCardsApiResponse>('/cards', body);
    return handleResponse(rawResponse);
  }
}
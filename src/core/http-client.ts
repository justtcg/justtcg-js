import { BatchLookupItem } from "../types";

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
}

export interface QueryParams {
  [key: string]: string | string[] | number | boolean | undefined | null;
}

interface BatchLookupItemStringified {
    /** A TCGplayer product ID. */
    tcgplayerId?: string;
    /** The TCGPlayer SKU of the specific variant. */
    tcgplayerSkuId?: string;
    /** A JustTCG card ID. */
    cardId?: string;
    /** A JustTCG variant ID. */
    variantId?: string;
    /** The Scryfall ID of the card. */
    scryfallId?: string;
    /** The MTGJSON ID of the card. */
    mtgjsonId?: string;
    /** An array of card print types to filter by. */
    printing?: string;
    /** An array of card conditions to filter by. */
    condition?: string;
    /** Option to include price history in the response. */
    include_price_history?: string;
    /** Option to include specific timeframes for the price statistics. */
    include_statistics?: string;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Performs a GET request to a given path.
   * @param path The endpoint path (e.g., '/games').
   * @param params Optional query parameters.
   * @returns The JSON response from the API.
   */
  public async get<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Safely append query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      // For now, we'll throw a generic error. We will enhance this later.
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'An API error occurred');
    }

    return response.json() as Promise<T>;
  }

  /**
   * Performs a POST request to a given path.
   * @param path The endpoint path (e.g., '/cards').
   * @param body The JSON body for the request.
   * @returns The JSON response from the API.
   */
  public async post<T>(path: string, body: BatchLookupItem[]): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Convert BatchLookupItem[] to BatchLookupItemStringified[]
    const stringifiedBody: BatchLookupItemStringified[] = body.map(item => {
      const stringifiedItem: BatchLookupItemStringified = {};
      if (item.tcgplayerId) stringifiedItem.tcgplayerId = item.tcgplayerId;
      if (item.tcgplayerSkuId) stringifiedItem.tcgplayerSkuId = item.tcgplayerSkuId;
      if (item.cardId) stringifiedItem.cardId = item.cardId;
      if (item.variantId) stringifiedItem.variantId = item.variantId;
      if (item.scryfallId) stringifiedItem.scryfallId = item.scryfallId;
      if (item.mtgjsonId) stringifiedItem.mtgjsonId = item.mtgjsonId;
      if (item.printing) stringifiedItem.printing = Array.isArray(item.printing) ? item.printing.join(',') : item.printing;
      if (item.condition) stringifiedItem.condition = Array.isArray(item.condition) ? item.condition.join(',') : item.condition;
      if (item.include_price_history !== undefined) stringifiedItem.include_price_history = String(item.include_price_history);
      if (item.include_statistics) stringifiedItem.include_statistics = Array.isArray(item.include_statistics) ? item.include_statistics.join(',') : item.include_statistics;
      return stringifiedItem;
    });

    console.log(stringifiedBody);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(stringifiedBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'An API error occurred');
    }

    return response.json() as Promise<T>;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey, // Add the API key header
    };
  }
}

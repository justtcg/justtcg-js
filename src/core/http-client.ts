import { createApiError } from '../errors';
import { BatchLookupItem } from '../types';

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  debug?: boolean;
}

export interface QueryParams {
  [key: string]:
    | string
    | number
    | boolean
    // Arrays are comma-joined on the wire. Mixed element types are allowed because v2 accepts
    // numeric values in list params (e.g. `grade=9.5,10`).
    | ReadonlyArray<string | number>
    | undefined
    | null;
}

/**
 * A response with its headers and status preserved.
 *
 * v1 carries usage in the `_metadata` body field, but v2 moves usage to `RateLimit-*` headers and
 * pagination to the RFC 8288 `Link` header — so the v2 resources need more than the parsed body.
 */
export interface JustTCGResponse<T> {
  /** The parsed response body. */
  body: T;
  /** The response headers, needed for `RateLimit-*` and `Link`. */
  headers: Headers;
  /** The HTTP status code. */
  status: number;
}

export interface RequestOptions {
  method: 'GET' | 'POST';
  /** The endpoint path, including the version prefix (e.g. `/v1/cards`). */
  path: string;
  /** Query parameters. Arrays are serialized comma-joined (`regions=NA,US`). */
  params?: QueryParams;
  /** A JSON body, serialized as-is. Only sent for POST. */
  body?: unknown;
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
    /** Filer by Updated after a specific date in Unix timestamp format (seconds since epoch). */
    updated_after?: string;
    /** An array of card print types to filter by. */
    printing?: string;
    /** An array of card conditions to filter by. */
    condition?: string;
    /** Option to include price history in the response. */
    include_price_history?: string;
    /** Option to include specific timeframes for the price statistics. */
    include_statistics?: string;
}

/**
 * Serialize a batch lookup body into the string-valued shape the v1 API expects.
 * v1-only: v2's batch grammar is snake_case (§6) and is sent via `postRaw`, bypassing this
 * camelCase allowlist entirely.
 */
function serializeBatchBody(body: BatchLookupItem[]): BatchLookupItemStringified[] {
  return body.map(item => {
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
    if (item.updated_after !== undefined) stringifiedItem.updated_after = String(item.updated_after);
    return stringifiedItem;
  });
}

/**
 * Parse a response body without assuming a content type.
 *
 * Returns the parsed JSON when the payload is JSON (including `application/problem+json`), the raw
 * text when it is not, and `undefined` for an empty body.
 */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly debug: boolean;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.debug = config.debug ?? false;
  }

  /**
   * Performs a request and returns the body alongside the response headers and status.
   *
   * This is the single code path all other methods delegate to. Failed responses are thrown as the
   * appropriate `JustTCGError` subclass, mapped from either v2's `problem+json` or v1's
   * `{ error, code }`.
   */
  public async request<T>(options: RequestOptions): Promise<JustTCGResponse<T>> {
    const url = new URL(`${this.baseUrl}${options.path}`);

    // Safely append query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Arrays are comma-joined: `regions=NA,US`, `grade=9.5,10`.
          url.searchParams.append(key, Array.isArray(value) ? value.join(',') : String(value));
        }
      });
    }

    const hasBody = options.method === 'POST' && options.body !== undefined;

    if (this.debug) {
      console.log(`[JustTCG] ${options.method} ${url.toString()}`);
      if (hasBody) console.log(options.body);
    }

    const response = await fetch(url.toString(), {
      method: options.method,
      headers: this.getHeaders(),
      ...(hasBody && { body: JSON.stringify(options.body) }),
    });

    const body = await parseBody(response);

    if (!response.ok) {
      throw createApiError(response.status, body, response.headers);
    }

    return { body: body as T, headers: response.headers, status: response.status };
  }

  /**
   * Performs a GET request to a given path.
   * @param path The endpoint path (e.g., '/games').
   * @param params Optional query parameters.
   * @returns The JSON response from the API.
   */
  public async get<T>(path: string, params?: QueryParams): Promise<T> {
    const { body } = await this.request<T>({ method: 'GET', path, params });
    return body;
  }

  /**
   * Performs a GET request, preserving the response headers and status.
   * @param path The endpoint path (e.g., '/cards').
   * @param params Optional query parameters.
   */
  public async getRaw<T>(path: string, params?: QueryParams): Promise<JustTCGResponse<T>> {
    return this.request<T>({ method: 'GET', path, params });
  }

  /**
   * Performs a POST request to a given path.
   * @param path The endpoint path (e.g., '/cards').
   * @param body The JSON body for the request.
   * @returns The JSON response from the API.
   */
  public async post<T>(path: string, body: BatchLookupItem[]): Promise<T> {
    const { body: responseBody } = await this.request<T>({
      method: 'POST',
      path,
      body: serializeBatchBody(body),
    });
    return responseBody;
  }

  /**
   * Performs a POST request with the body sent as-is, preserving the response headers and status.
   *
   * Unlike `post`, the body is not passed through the v1 field allowlist, and query parameters are
   * supported — the v2 batch endpoint reads `regions` from the query string.
   * @param path The endpoint path (e.g., '/cards').
   * @param body The JSON body, serialized verbatim.
   * @param params Optional query parameters.
   */
  public async postRaw<T>(
    path: string,
    body: unknown,
    params?: QueryParams,
  ): Promise<JustTCGResponse<T>> {
    return this.request<T>({ method: 'POST', path, params, body });
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey, // Add the API key header
    };
  }
}

import { parseV2Pagination, parseV2Usage } from '../../core/v2-response-handler';
import { NotFoundError } from '../../errors';
import {
  GetV2CardsParams,
  V2ApiResponse,
  V2BarcodeLookupOptions,
  V2BatchLookupItem,
  V2BatchOptions,
  V2Card,
  V2CardResponseBody,
  V2CardsResponseBody,
  V2RetrieveOptions,
  V2SearchOptions,
} from '../../types/v2';
import { V2BaseResource } from './base';

/**
 * Provides access to the `/v2/cards` API resource (public beta).
 *
 * Every method returns `{ data, pagination?, usage }`, the same envelope v1 returns — but `usage`
 * is read from the `RateLimit-*` headers and `pagination` is cursor-based rather than offset-based.
 */
export class V2CardsResource extends V2BaseResource {
  /**
   * Retrieves cards matching a flexible set of query parameters.
   *
   * With no parameters this browses; with `q` or `number` it searches; with `card_id` or
   * `variant_id` it looks up directly. For a direct lookup prefer {@link retrieve} (which calls the
   * canonical `GET /v2/cards/{id}`) or {@link retrieveVariant} — both unwrap the single result.
   * @param params Parameters for searching, filtering, and paginating cards.
   */
  public async get(params: GetV2CardsParams = {}): Promise<V2ApiResponse<V2Card[]>> {
    const response = await this._get<V2CardsResponseBody>('/cards', params);
    return {
      data: response.body.data,
      pagination: parseV2Pagination(response.headers, response.body.meta),
      usage: parseV2Usage(response.headers),
    };
  }

  /**
   * A convenience method to search for cards by name.
   *
   * A 12–14 digit barcode passed as `query` is matched as a GTIN first and falls back to a name
   * search if no product carries it, so raw scanner input works here. Use {@link getByBarcode}
   * when you know the input is a barcode: it 404s rather than falling back.
   * @param query A search query for the card's name.
   * @param options Optional parameters to filter or paginate the results.
   */
  public async search(
    query: string,
    options?: V2SearchOptions,
  ): Promise<V2ApiResponse<V2Card[]>> {
    return this.get({ ...options, q: query });
  }

  /**
   * Walks every page of a query, yielding one page at a time.
   *
   * Each page is the same envelope {@link get} returns, so `usage` stays visible as you go — useful
   * for stopping early when the quota gets low. Pages are fetched lazily: breaking out of the loop
   * stops the requests.
   *
   * ```ts
   * for await (const page of client.v2.cards.iteratePages({ game: 'pokemon' })) {
   *   console.log(page.data.length, page.usage.remaining);
   * }
   * ```
   * @param params The same parameters as {@link get}. `limit` sets the page size; passing a
   *   `cursor` resumes from that point rather than the first page.
   */
  public async *iteratePages(
    params: GetV2CardsParams = {},
  ): AsyncGenerator<V2ApiResponse<V2Card[]>, void, undefined> {
    let cursor = params.cursor;
    // Cursors are opaque, so the SDK cannot tell a stalled cursor from a valid one by inspection.
    // Remembering the ones already used turns a server-side pagination bug into a terminated loop
    // rather than an infinite one.
    const seen = new Set<string>(cursor === undefined ? [] : [cursor]);

    for (;;) {
      const page = await this.get({ ...params, cursor });
      yield page;

      const next = page.pagination?.nextCursor;
      if (next === undefined || seen.has(next)) return;

      seen.add(next);
      cursor = next;
    }
  }

  /**
   * Walks every page of a query, yielding one card at a time.
   *
   * The flattened form of {@link iteratePages} — use that one if you need `usage` or the page
   * boundaries.
   *
   * ```ts
   * for await (const card of client.v2.cards.iterate({ game: 'pokemon', limit: 100 })) {
   *   console.log(card.name);
   * }
   * ```
   * @param params The same parameters as {@link get}.
   */
  public async *iterate(
    params: GetV2CardsParams = {},
  ): AsyncGenerator<V2Card, void, undefined> {
    for await (const page of this.iteratePages(params)) {
      for (const card of page.data) yield card;
    }
  }

  /**
   * Retrieves a single card by its ID, via the canonical direct lookup `GET /v2/cards/{id}`.
   *
   * This is the only lookup that accepts `graded: 'include'`. The identifier may be either the v2
   * UUID or a legacy v1 slug, so an existing v1 card ID keeps working.
   * @param cardId The card's UUID or legacy slug.
   * @param options Optional parameters to shape the response.
   * @throws {NotFoundError} When no card matches `cardId`.
   */
  public async retrieve(
    cardId: string,
    options?: V2RetrieveOptions,
  ): Promise<V2ApiResponse<V2Card>> {
    const response = await this._get<V2CardResponseBody>(
      `/cards/${encodeURIComponent(cardId)}`,
      { ...options },
    );
    // The spec documents `data` as a single card, but the live API (2026-10-20) still sends a
    // one-element array here, so accept both. The server 404s when nothing matches; the guard
    // covers a success response with no card in it.
    const { data } = response.body;
    const card = Array.isArray(data) ? data[0] : data;
    if (!card) throw notFound(cardId, response.status);

    return { data: card, usage: parseV2Usage(response.headers) };
  }

  /**
   * Retrieves the card owning a single variant — the fastest lookup in the API.
   *
   * The returned card carries only the variants matching the request, so this is the direct way to
   * price one specific printing, condition, or graded slab.
   * @param variantId The variant's UUID or legacy slug.
   * @param options Optional parameters to shape the response.
   */
  public async retrieveVariant(
    variantId: string,
    options?: V2RetrieveOptions,
  ): Promise<V2ApiResponse<V2Card>> {
    // There is no variant path, so this stays on the query-param form of the list endpoint.
    return this.retrieveOne(variantId, { ...options, variant_id: variantId });
  }

  /**
   * Retrieves a single card by its TCGplayer product ID (v1's `tcgplayerId`).
   * @param tcgplayerId The TCGplayer product ID.
   * @param options Optional parameters to shape the response.
   * @throws {NotFoundError} When no card carries `tcgplayerId`.
   */
  public async retrieveByTcgplayerId(
    tcgplayerId: string,
    options?: V2RetrieveOptions,
  ): Promise<V2ApiResponse<V2Card>> {
    return this.retrieveOne(tcgplayerId, { ...options, tcgplayer_id: tcgplayerId });
  }

  /**
   * Retrieves the card owning a single variant, by the variant's TCGplayer SKU ID (v1's
   * `tcgplayerSkuId`). As with {@link retrieveVariant}, the card carries only that variant.
   * @param tcgplayerSkuId The TCGplayer SKU ID.
   * @param options Optional parameters to shape the response.
   * @throws {NotFoundError} When no variant carries `tcgplayerSkuId`.
   */
  public async retrieveByTcgplayerSkuId(
    tcgplayerSkuId: string,
    options?: V2RetrieveOptions,
  ): Promise<V2ApiResponse<V2Card>> {
    return this.retrieveOne(tcgplayerSkuId, { ...options, tcgplayer_sku_id: tcgplayerSkuId });
  }

  /**
   * Looks up sealed product by its retail barcode (GTIN).
   *
   * Accepts a 12-digit UPC-A, 13-digit EAN-13 or JAN, 8-digit EAN-8 or 14-digit GTIN-14; spaces and
   * hyphens are ignored. One barcode can belong to several listings, so this returns an array.
   * Coverage is currently sealed Magic: The Gathering, Pokémon and Yu-Gi-Oh! product.
   * @param gtin The code printed under the barcode.
   * @param options Optional parameters to shape the response. Grading params are not accepted.
   * @throws {ValidationError} When the check digit is invalid (`parameter` is `'gtin'`).
   * @throws {NotFoundError} When the code is valid but no product carries it.
   */
  public async getByBarcode(
    gtin: string,
    options?: V2BarcodeLookupOptions,
  ): Promise<V2ApiResponse<V2Card[]>> {
    const response = await this._get<V2CardsResponseBody>('/cards', { ...options, gtin });
    // The server 404s an unknown code; this covers a success response with nothing in it.
    if (response.body.data.length === 0) throw notFound(gtin, response.status);

    return { data: response.body.data, usage: parseV2Usage(response.headers) };
  }

  /**
   * Retrieves cards matching a batch of specific identifiers.
   *
   * The body grammar is snake_case (`card_id`, `tcgplayer_id`, …), matching every other v2 param —
   * a v1 batch payload is **not** accepted as-is and needs its keys renamed. The maximum number of
   * items is your plan's per-request limit, the same as v1's batch.
   *
   * The response is one entry per **card**, not per item: variants of the same card are grouped
   * under it, duplicate items collapse, and items that match nothing are dropped without an
   * error. `pagination.count` (from `meta.count`) counts the returned cards, so it is not a
   * completeness check — compare the IDs in `data` against the identifiers you sent instead.
   * There are no cursors: a batch is always a single page.
   *
   * Graded variants come back only when they already have a price and are named by `variant_id`;
   * batch does not accept `graded`, `grading_company` or `grade`.
   * @param items An array of objects, each identifying a card to look up.
   * @param options Request-wide options — `include`, `updated_after` and `regions` — sent on the
   *   query string and applied to every item.
   */
  public async getByBatch(
    items: V2BatchLookupItem[],
    options?: V2BatchOptions,
  ): Promise<V2ApiResponse<V2Card[]>> {
    const response = await this._post<V2CardsResponseBody>('/cards', items, {
      include: options?.include,
      updated_after: options?.updated_after,
      regions: options?.regions,
    });
    const count = response.body.meta?.count;
    return {
      data: response.body.data,
      ...(count !== undefined && { pagination: { hasMore: false, count } }),
      usage: parseV2Usage(response.headers),
    };
  }

  /**
   * Runs a query-param lookup and unwraps the single card.
   *
   * The endpoint returns `{ data: [...] }` even for a direct lookup, and 404s when nothing matches;
   * the empty-array guard is belt-and-braces against a success response with no card.
   */
  private async retrieveOne(
    identifier: string,
    params: GetV2CardsParams,
  ): Promise<V2ApiResponse<V2Card>> {
    const response = await this._get<V2CardsResponseBody>('/cards', params);
    const card = response.body.data[0];
    if (!card) throw notFound(identifier, response.status);

    return { data: card, usage: parseV2Usage(response.headers) };
  }
}

function notFound(identifier: string, status: number): NotFoundError {
  return new NotFoundError(`No card found for '${identifier}'.`, { status, code: 'not-found' });
}

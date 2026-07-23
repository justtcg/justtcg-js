import { parseV2Pagination, parseV2Usage } from '../../core/v2-response-handler';
import { NotFoundError } from '../../errors';
import {
  GetV2CardsParams,
  V2ApiResponse,
  V2BatchLookupItem,
  V2BatchOptions,
  V2Card,
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
   * `variant_id` it looks up directly. Prefer {@link retrieve} for the last case — it unwraps the
   * single result for you.
   * @param params Parameters for searching, filtering, and paginating cards.
   */
  public async get(params: GetV2CardsParams = {}): Promise<V2ApiResponse<V2Card[]>> {
    const response = await this._get<V2CardsResponseBody>('/cards', params);
    return {
      data: response.body.data,
      pagination: parseV2Pagination(response.headers),
      usage: parseV2Usage(response.headers),
    };
  }

  /**
   * A convenience method to search for cards by name.
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
   * Retrieves a single card by its ID.
   *
   * This is the only lookup that accepts `graded: 'include'`. The identifier may be either the v2
   * UUID or a legacy v1 slug, so an existing v1 card ID keeps working.
   * @param cardId The card's UUID or legacy slug.
   * @param options Optional parameters to shape the response.
   */
  public async retrieve(
    cardId: string,
    options?: V2RetrieveOptions,
  ): Promise<V2ApiResponse<V2Card>> {
    return this.retrieveOne({ ...options, card_id: cardId });
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
    return this.retrieveOne({ ...options, variant_id: variantId });
  }

  /**
   * Retrieves cards matching a batch of specific identifiers.
   *
   * The body grammar is unchanged from v1, so an existing batch payload can be sent as-is. Batch
   * responses are never paginated, and always contain raw variants only.
   * @param items An array of objects, each identifying a card to look up.
   * @param options Request-wide options; `regions` applies to every item.
   */
  public async getByBatch(
    items: V2BatchLookupItem[],
    options?: V2BatchOptions,
  ): Promise<V2ApiResponse<V2Card[]>> {
    const response = await this._post<V2CardsResponseBody>('/cards', items, {
      regions: options?.regions,
    });
    return {
      data: response.body.data,
      usage: parseV2Usage(response.headers),
    };
  }

  /**
   * Runs a direct lookup and unwraps the single card.
   *
   * The endpoint returns `{ data: [...] }` even for a direct lookup, and 404s when nothing matches;
   * the empty-array guard is belt-and-braces against a response that reports success with no card.
   */
  private async retrieveOne(params: GetV2CardsParams): Promise<V2ApiResponse<V2Card>> {
    const response = await this._get<V2CardsResponseBody>('/cards', params);
    const card = response.body.data[0];

    if (!card) {
      const identifier = params.card_id ?? params.variant_id;
      throw new NotFoundError(`No card found for '${identifier}'.`, {
        status: response.status,
        code: 'not-found',
      });
    }

    return { data: card, usage: parseV2Usage(response.headers) };
  }
}

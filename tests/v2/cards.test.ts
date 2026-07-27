import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JustTCG } from '../../src/index';
import { NotFoundError, RegionNotAvailableError, ValidationError } from '../../src/errors';
import type { V2Card } from '../../src/types/v2';

/**
 * These exercise the real `HttpClient` against a stubbed `fetch`, so a v2 request is asserted
 * end-to-end: params onto the query string, headers into `usage`/`pagination`, problem+json into a
 * typed error.
 */

const CARD: V2Card = {
  id: '907005b3-b7bd-5eac-aed9-d20454b7fe8a',
  slug: 'pokemon-base-set-charizard-4',
  name: 'Charizard',
  game: { id: 'pokemon', name: 'Pokemon' },
  set: { id: 'base-set-pokemon', name: 'Base Set' },
  number: '4',
  rarity: 'Rare Holo',
  external_ids: { tcgplayer: '42', scryfall: null, mtgjson: null },
  details: null,
  variants: [
    {
      id: 'e72a67fe-922e-5662-bcfc-e8cb509f8220',
      slug: 'pokemon-base-set-charizard-4_near-mint',
      type: 'raw',
      condition: 'Near Mint',
      printing: 'Holofoil',
      language: 'English',
      external_ids: { tcgplayer_sku: '12345' },
      grading: null,
      markets: [
        {
          region: 'US',
          currency: 'USD',
          price: 420.69,
          updated_at: 1_763_000_000,
          change_24h_pct: 2.5,
          periods: { '7d': { avg: 410, min: 400, max: 430 } },
          price_history: [],
        },
      ],
    },
  ],
};

const RATE_LIMIT_HEADERS = {
  'RateLimit-Limit': '10000',
  'RateLimit-Remaining': '9987',
  'RateLimit-Reset': '43200',
  'RateLimit-Policy': '"daily";q=1000;w=86400',
};

function mockFetch(
  body: unknown,
  init: { status?: number; headers?: Record<string, string>; contentType?: string } = {},
) {
  const status = init.status ?? 200;
  const headers = new Headers({
    'Content-Type': init.contentType ?? 'application/json',
    ...RATE_LIMIT_HEADERS,
    ...init.headers,
  });
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string);
}

describe('v2 cards', () => {
  let client: JustTCG;

  beforeEach(() => {
    client = new JustTCG({ apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('browse', () => {
    it('requests /v2/cards with no params and returns usage', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      const result = await client.v2.cards.get();

      expect(calledUrl(fetchMock).pathname).toBe('/v2/cards');
      expect(calledUrl(fetchMock).search).toBe('');
      expect(result.data).toHaveLength(1);
      expect(result.usage).toEqual({
        limit: 10000,
        remaining: 9987,
        reset: 43200,
        policy: '"daily";q=1000;w=86400',
      });
    });

    it('serializes filters, comma-joining list params', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.v2.cards.get({
        game: 'pokemon',
        regions: ['US', 'NA'],
        include: ['periods.30d', 'price_history.90d'],
        min_price: 10,
        orderBy: '30d',
        order: 'asc',
        limit: 50,
      });

      const url = calledUrl(fetchMock);
      expect(url.searchParams.get('game')).toBe('pokemon');
      expect(url.searchParams.get('regions')).toBe('US,NA');
      expect(url.searchParams.get('include')).toBe('periods.30d,price_history.90d');
      expect(url.searchParams.get('min_price')).toBe('10');
      expect(url.searchParams.get('orderBy')).toBe('30d');
      expect(url.searchParams.get('limit')).toBe('50');
    });

    it('exposes the cursor from the Link header', async () => {
      mockFetch(
        { data: [CARD] },
        { headers: { Link: '</v2/cards?cursor=eyJvIjoyMH0=&limit=20>; rel="next"' } },
      );

      const result = await client.v2.cards.get({ game: 'pokemon' });

      expect(result.pagination).toEqual({ nextCursor: 'eyJvIjoyMH0=', hasMore: true });
    });

    it('reports hasMore false when the response carries no Link header', async () => {
      mockFetch({ data: [CARD] });

      const result = await client.v2.cards.get({ game: 'pokemon' });

      expect(result.pagination).toEqual({ hasMore: false });
    });

    it('exposes total and count from the response body meta', async () => {
      mockFetch({ data: [CARD], meta: { count: 1, total: 31474, has_more: true } });

      const result = await client.v2.cards.get({ game: 'pokemon' });

      expect(result.pagination?.total).toBe(31474);
      expect(result.pagination?.count).toBe(1);
    });

    it('forwards a cursor back as a query param', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.v2.cards.get({ game: 'pokemon', cursor: 'eyJvIjoyMH0=' });

      expect(calledUrl(fetchMock).searchParams.get('cursor')).toBe('eyJvIjoyMH0=');
    });
  });

  describe('search', () => {
    it('sends the query as `q`, not v1’s `query`', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      await client.v2.cards.search('charizard', { game: 'pokemon', limit: 10 });

      const url = calledUrl(fetchMock);
      expect(url.searchParams.get('q')).toBe('charizard');
      expect(url.searchParams.has('query')).toBe(false);
      expect(url.searchParams.get('game')).toBe('pokemon');
    });

    it('does not let options override the query argument', async () => {
      const fetchMock = mockFetch({ data: [] });

      // `q` is omitted from V2SearchOptions, but a JS caller can still pass it through.
      await client.v2.cards.search('charizard', { q: 'blastoise' } as never);

      expect(calledUrl(fetchMock).searchParams.get('q')).toBe('charizard');
    });
  });

  describe('retrieve', () => {
    it('looks up by card_id and unwraps the single card', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      const result = await client.v2.cards.retrieve(CARD.id, {
        graded: 'include',
        regions: ['US'],
      });

      const url = calledUrl(fetchMock);
      // Per the resolved contract question: the query-param form, not the path form.
      expect(url.pathname).toBe('/v2/cards');
      expect(url.searchParams.get('card_id')).toBe(CARD.id);
      expect(url.searchParams.get('graded')).toBe('include');
      // A single card, not an array — the endpoint always sends `{ data: [...] }`.
      expect(result.data.name).toBe('Charizard');
      expect(result.pagination).toBeUndefined();
      expect(result.usage.remaining).toBe(9987);
    });

    it('accepts a legacy v1 slug as the identifier', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      await client.v2.cards.retrieve('pokemon-base-set-charizard-4');

      expect(calledUrl(fetchMock).searchParams.get('card_id')).toBe(
        'pokemon-base-set-charizard-4',
      );
    });

    it('looks up by variant_id', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      await client.v2.cards.retrieveVariant('e72a67fe-922e-5662-bcfc-e8cb509f8220');

      const url = calledUrl(fetchMock);
      expect(url.searchParams.get('variant_id')).toBe('e72a67fe-922e-5662-bcfc-e8cb509f8220');
      expect(url.searchParams.has('card_id')).toBe(false);
    });

    it('throws NotFoundError when a 200 carries an empty array', async () => {
      mockFetch({ data: [] });

      await expect(client.v2.cards.retrieve('nope')).rejects.toThrow(NotFoundError);
      await expect(client.v2.cards.retrieve('nope')).rejects.toThrow(/nope/);
    });

    it('surfaces the server 404 as NotFoundError', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/not-found',
          title: 'Resource not found',
          status: 404,
          detail: 'No card matches that identifier.',
        },
        { status: 404, contentType: 'application/problem+json' },
      );

      await expect(client.v2.cards.retrieve('nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getByBatch', () => {
    it('posts the items verbatim and sends regions as a query param', async () => {
      const fetchMock = mockFetch({ data: [CARD] });

      const result = await client.v2.cards.getByBatch(
        [{ cardId: CARD.id, condition: ['Near Mint'] }, { tcgplayerId: '42' }],
        { regions: ['US', 'NA'] },
      );

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
      // `regions` is request-wide, so it rides the query string rather than each item.
      expect(new URL(url).searchParams.get('regions')).toBe('US,NA');
      expect(JSON.parse(init.body as string)).toEqual([
        { cardId: CARD.id, condition: ['Near Mint'] },
        { tcgplayerId: '42' },
      ]);
      // Batch responses are never paginated.
      expect(result.pagination).toBeUndefined();
      expect(result.usage.limit).toBe(10000);
    });

    it('omits regions entirely when no options are given', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.v2.cards.getByBatch([{ cardId: CARD.id }]);

      expect(new URL(fetchMock.mock.calls[0][0] as string).search).toBe('');
    });
  });

  describe('errors', () => {
    it('maps invalid-parameter to ValidationError carrying the parameter', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/invalid-parameter',
          title: 'Invalid parameter',
          status: 400,
          detail: "graded=include requires a direct lookup.",
          parameter: 'graded',
        },
        { status: 400, contentType: 'application/problem+json' },
      );

      await expect(client.v2.cards.get({ graded: 'include' })).rejects.toThrow(ValidationError);
      await expect(client.v2.cards.get({ graded: 'include' })).rejects.toMatchObject({
        parameter: 'graded',
      });
    });

    it('maps region-not-available and lists the serviceable regions', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/region-not-available',
          title: 'Region not yet available',
          status: 400,
          detail: 'Region JP is not yet available.',
          available: ['NA', 'US'],
        },
        { status: 400, contentType: 'application/problem+json' },
      );

      const promise = client.v2.cards.get({ regions: ['JP'] });
      await expect(promise).rejects.toThrow(RegionNotAvailableError);
      await expect(promise).rejects.toMatchObject({ available: ['NA', 'US'] });
    });
  });

  it('leaves the v1 client reachable and pointed at /v1', async () => {
    const fetchMock = mockFetch({ data: [], _metadata: {} });

    await client.v1.games.list();

    expect(calledUrl(fetchMock).pathname).toBe('/v1/games');
  });
});

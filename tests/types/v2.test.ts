import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpClient } from '../../src/core/http-client';
import type {
  GetV2CardsParams,
  V2Card,
  V2CardsResponseBody,
  V2IncludeComponent,
  V2Period,
} from '../../src/types/v2';
import { V2_DEFAULT_REGION, V2_SERVICEABLE_REGIONS } from '../../src/types/v2';

/**
 * These tests double as compile-time assertions: the v2 types are structural, so a drift between
 * `GetV2CardsParams` and `QueryParams` (or between the declared shape and the wire shape) fails
 * `tsc --noEmit` even when the runtime assertions below still pass.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('v2 types', () => {
  it('serializes a fully-populated GetV2CardsParams onto the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: () => Promise.resolve('{"data":[]}'),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Every documented v2 parameter, to prove the type is assignable to QueryParams.
    const params: GetV2CardsParams = {
      card_id: '907005b3-b7bd-5eac-aed9-d20454b7fe8a',
      regions: ['US', 'NA'],
      graded: 'include',
      grading_company: 'PSA',
      grade: [9.5, 10],
      include: ['periods.30d', 'price_history.90d'],
      condition: ['Near Mint', 'LP'],
      printing: ['Holofoil'],
      min_price: 1.25,
      order: 'asc',
      order_by: '7d',
      limit: 50,
      cursor: 'eyJvIjo1MH0=',
    };

    const client = new HttpClient({ apiKey: 'k', baseUrl: 'https://api.justtcg.com' });
    await client.get<V2CardsResponseBody>('/v2/cards', params);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    // Mixed string/number arrays comma-join; this is why QueryParams allows numeric elements.
    expect(url.searchParams.get('grade')).toBe('9.5,10');
    expect(url.searchParams.get('regions')).toBe('US,NA');
    expect(url.searchParams.get('include')).toBe('periods.30d,price_history.90d');
    expect(url.searchParams.get('condition')).toBe('Near Mint,LP');
    expect(url.searchParams.get('order_by')).toBe('7d');
    expect(url.searchParams.get('min_price')).toBe('1.25');
  });

  it('models a graded variant with a null condition and a populated grading object', () => {
    const card: V2Card = {
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
          slug: 'pokemon-base-set-charizard-4_psa-10',
          type: 'graded',
          condition: null,
          printing: 'Holofoil',
          language: 'English',
          external_ids: { tcgplayer_sku: null },
          grading: {
            company: 'PSA',
            grade: 10,
            grade_label: null,
            qualifier: null,
            canonical: 'PSA 10',
          },
          markets: [
            {
              region: 'US',
              currency: 'USD',
              price: 12345.67,
              updated_at: 1_763_000_000,
              change_24h_pct: -1.5,
              // Only the requested window is present — absent is not null.
              periods: { '30d': { avg: 12000, min: 11000, max: 13000 } },
              price_history: [{ t: 1_762_900_000, p: 12500 }],
            },
          ],
        },
      ],
    };

    const variant = card.variants[0];
    expect(variant.grading?.canonical).toBe('PSA 10');
    expect(variant.condition).toBeNull();
    // markets[0] is the primary market — the drop-in replacement for v1's flat `price`.
    expect(variant.markets[0].price).toBe(12345.67);
    expect(variant.markets[0].periods['7d']).toBeUndefined();
  });

  it('leaves every V2Period field optional, so an empty window is valid', () => {
    // A variant with no sales aggregates gets `periods: {}` rather than a null-filled object.
    const empty: V2Period = {};
    expect(empty.avg).toBeUndefined();
  });

  it('exposes the serviceable regions and the default region', () => {
    expect(V2_SERVICEABLE_REGIONS).toEqual(['NA', 'US']);
    // The code, not the docs, is the source of truth here: omitting `regions` yields US.
    expect(V2_DEFAULT_REGION).toBe('US');
    expect(V2_SERVICEABLE_REGIONS).toContain(V2_DEFAULT_REGION);
  });

  it('accepts bare and windowed include components', () => {
    const components: V2IncludeComponent[] = [
      'periods',
      'periods.all_time',
      'price_history',
      'price_history.180d',
    ];
    expect(components).toHaveLength(4);
  });
});

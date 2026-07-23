import { describe, it, expect } from 'vitest';
import { toV1Card, toV1Cards, toV1Variant, V1_PERIOD_FIELDS } from '../../src/v2/compat';
import type { Card, Variant } from '../../src/types';
import type { V2Card, V2Variant } from '../../src/types/v2';

/**
 * A matched pair for the same card: the v2 payload, and the v1 payload the old endpoint produced
 * for it. `toV1Card(V2)` must equal `V1` exactly — that equality is the whole contract of the
 * adapter, so the assertions below compare the full object rather than spot-checking fields.
 */

const V2: V2Card = {
  id: '907005b3-b7bd-5eac-aed9-d20454b7fe8a',
  slug: 'pokemon-base-set-charizard-4',
  name: 'Charizard',
  game: { id: 'pokemon', name: 'Pokemon' },
  set: { id: 'base-set-pokemon', name: 'Base Set' },
  number: '4',
  rarity: 'Rare Holo',
  external_ids: { tcgplayer: '42', scryfall: null, mtgjson: null },
  details: 'Shadowless',
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
          periods: {
            '7d': {
              change_pct: 3.1,
              avg: 410.5,
              min: 400,
              max: 430,
              stddev: 9.25,
              cov: 0.0225,
              iqr: 12.5,
              trend_slope: 1.75,
              changes_count: 6,
            },
            '30d': {
              change_pct: -4.2,
              avg: 435.1,
              min: 395,
              max: 470,
              stddev: 18.4,
              cov: 0.0423,
              iqr: 25,
              trend_slope: -2.1,
              changes_count: 22,
              range_position: 0.34,
            },
            '90d': {
              change_pct: 12.8,
              avg: 390.2,
              min: 350,
              max: 480,
              stddev: 31.7,
              cov: 0.0812,
              iqr: 44,
              trend_slope: 0.95,
              changes_count: 61,
              range_position: 0.54,
            },
            '1y': { min: 300, max: 520 },
            all_time: {
              min: 42.5,
              max: 610,
              min_date: '2019-03-14',
              max_date: '2021-01-08',
            },
          },
          price_history: [
            { t: 1_762_900_000, p: 415.0 },
            { t: 1_763_000_000, p: 420.69 },
          ],
        },
      ],
    },
  ],
};

const V1: Card = {
  id: 'pokemon-base-set-charizard-4',
  uuid: '907005b3-b7bd-5eac-aed9-d20454b7fe8a',
  name: 'Charizard',
  game: 'Pokemon',
  set: 'base-set-pokemon',
  set_name: 'Base Set',
  number: '4',
  rarity: 'Rare Holo',
  tcgplayerId: '42',
  scryfallId: null,
  mtgjsonId: null,
  details: 'Shadowless',
  variants: [
    {
      id: 'pokemon-base-set-charizard-4_near-mint',
      uuid: 'e72a67fe-922e-5662-bcfc-e8cb509f8220',
      condition: 'Near Mint',
      printing: 'Holofoil',
      language: 'English',
      tcgplayerSkuId: '12345',
      price: 420.69,
      lastUpdated: 1_763_000_000,
      priceChange24hr: 2.5,
      priceHistory: [
        { t: 1_762_900_000, p: 415.0 },
        { t: 1_763_000_000, p: 420.69 },
      ],

      priceChange7d: 3.1,
      avgPrice: 410.5,
      minPrice7d: 400,
      maxPrice7d: 430,
      stddevPopPrice7d: 9.25,
      covPrice7d: 0.0225,
      iqrPrice7d: 12.5,
      trendSlope7d: 1.75,
      priceChangesCount7d: 6,

      priceChange30d: -4.2,
      avgPrice30d: 435.1,
      minPrice30d: 395,
      maxPrice30d: 470,
      stddevPopPrice30d: 18.4,
      covPrice30d: 0.0423,
      iqrPrice30d: 25,
      trendSlope30d: -2.1,
      priceChangesCount30d: 22,
      priceRelativeTo30dRange: 0.34,

      priceChange90d: 12.8,
      avgPrice90d: 390.2,
      minPrice90d: 350,
      maxPrice90d: 480,
      stddevPopPrice90d: 31.7,
      covPrice90d: 0.0812,
      iqrPrice90d: 44,
      trendSlope90d: 0.95,
      priceChangesCount90d: 61,
      priceRelativeTo90dRange: 0.54,

      minPrice1y: 300,
      maxPrice1y: 520,

      minPriceAllTime: 42.5,
      maxPriceAllTime: 610,
      minPriceAllTimeDate: '2019-03-14',
      maxPriceAllTimeDate: '2021-01-08',
    },
  ],
};

/** The graded slab for the same card, which v1 never returned. */
const GRADED: V2Variant = {
  id: '11111111-2222-3333-4444-555555555555',
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
      price: 99_000,
      updated_at: 1_763_000_000,
      change_24h_pct: null,
      periods: {},
      price_history: [],
    },
  ],
};

describe('toV1Card', () => {
  it('reproduces the v1 payload exactly', () => {
    expect(toV1Card(V2)).toEqual(V1);
  });

  it('swaps id and uuid back to their v1 meanings', () => {
    const result = toV1Card(V2);

    // v2 promoted the UUID to `id`; v1 wants the slug there.
    expect(result.id).toBe(V2.slug);
    expect(result.uuid).toBe(V2.id);
    expect(result.variants[0].id).toBe(V2.variants[0].slug);
    expect(result.variants[0].uuid).toBe(V2.variants[0].id);
  });

  it('flattens the nested game, set, and external ids', () => {
    const result = toV1Card(V2);

    // v1's flat `game` is the display name — the slug in `game.id` has no v1 home.
    expect(result.game).toBe('Pokemon');
    expect(result.set).toBe('base-set-pokemon');
    expect(result.set_name).toBe('Base Set');
    expect(result.tcgplayerId).toBe('42');
  });

  it('omits set_name rather than nulling it when the set has no name', () => {
    const result = toV1Card({ ...V2, set: { id: 'unknown-set', name: null } });

    expect('set_name' in result).toBe(false);
  });

  it('does not mutate the input', () => {
    const snapshot = JSON.stringify(V2);
    toV1Card(V2);

    expect(JSON.stringify(V2)).toBe(snapshot);
  });
});

describe('toV1Card periods', () => {
  it('maps every window in the table onto a distinct v1 field', () => {
    const targets = Object.values(V1_PERIOD_FIELDS).flatMap(fields => Object.values(fields));

    expect(new Set(targets).size).toBe(targets.length);
  });

  it.each(
    Object.entries(V1_PERIOD_FIELDS).flatMap(([window, fields]) =>
      Object.entries(fields).map(([v2Field, v1Field]) => [window, v2Field, v1Field] as const),
    ),
  )('maps periods.%s.%s to %s', (window, v2Field, v1Field) => {
    const period = V2.variants[0].markets[0].periods[window as keyof typeof V1_PERIOD_FIELDS];
    const expected = period?.[v2Field as keyof typeof period];

    // The fixture populates every field in the table; a gap here means the table grew and the
    // fixture did not.
    expect(expected).toBeDefined();
    expect(toV1Variant(V2.variants[0])[v1Field as keyof Variant]).toBe(expected);
  });

  it('routes the 7-day mean to avgPrice, not avgPrice7d', () => {
    const result = toV1Variant(V2.variants[0]);

    expect(result.avgPrice).toBe(410.5);
    expect('avgPrice7d' in result).toBe(false);
  });

  it('omits a window that was not requested rather than nulling its fields', () => {
    const variant = toV1Variant({
      ...V2.variants[0],
      markets: [{ ...V2.variants[0].markets[0], periods: { '7d': { avg: 410.5 } } }],
    });

    expect(variant.avgPrice).toBe(410.5);
    expect('minPrice7d' in variant).toBe(false);
    expect('priceChange30d' in variant).toBe(false);
    expect('minPriceAllTime' in variant).toBe(false);
  });
});

describe('toV1Card graded variants', () => {
  it('drops graded variants by default, as v1 did', () => {
    const result = toV1Card({ ...V2, variants: [...V2.variants, GRADED] });

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].id).toBe('pokemon-base-set-charizard-4_near-mint');
  });

  it('keeps them under includeGraded, labelling condition with the canonical grade', () => {
    const result = toV1Card({ ...V2, variants: [...V2.variants, GRADED] }, { includeGraded: true });

    expect(result.variants).toHaveLength(2);
    expect(result.variants[1].condition).toBe('PSA 10');
    expect(result.variants[1].price).toBe(99_000);
  });

  it('yields an empty variants array when every variant is graded', () => {
    expect(toV1Card({ ...V2, variants: [GRADED] }).variants).toEqual([]);
  });
});

describe('toV1Card regions', () => {
  const multiRegion: V2Card = {
    ...V2,
    variants: [
      {
        ...V2.variants[0],
        markets: [
          V2.variants[0].markets[0],
          {
            region: 'EU',
            currency: 'EUR',
            price: 389.0,
            updated_at: 1_762_000_000,
            change_24h_pct: -1.1,
            periods: { '7d': { avg: 392.0 } },
            price_history: [{ t: 1_762_000_000, p: 389.0 }],
          },
        ],
      },
    ],
  };

  it('flattens the primary market by default', () => {
    const variant = toV1Card(multiRegion).variants[0];

    expect(variant.price).toBe(420.69);
    expect(variant.avgPrice).toBe(410.5);
  });

  it('flattens a named region instead', () => {
    const variant = toV1Card(multiRegion, { region: 'EU' }).variants[0];

    expect(variant.price).toBe(389.0);
    expect(variant.lastUpdated).toBe(1_762_000_000);
    expect(variant.avgPrice).toBe(392.0);
    expect(variant.priceHistory).toEqual([{ t: 1_762_000_000, p: 389.0 }]);
  });

  it('nulls the price for a region the card has no entry for', () => {
    // Falling back to another market would hand back a price in the wrong currency, which is a
    // worse failure than no price at all.
    const variant = toV1Card(multiRegion, { region: 'JP' }).variants[0];

    expect(variant.price).toBeNull();
    expect(variant.lastUpdated).toBeNull();
    expect(variant.priceHistory).toBeNull();
    expect('avgPrice' in variant).toBe(false);
  });
});

describe('toV1Variant edge cases', () => {
  it('mirrors a null price rather than substituting zero', () => {
    const variant = toV1Variant({
      ...V2.variants[0],
      markets: [{ ...V2.variants[0].markets[0], price: null, updated_at: null }],
    });

    expect(variant.price).toBeNull();
    expect(variant.lastUpdated).toBeNull();
  });

  it('omits tcgplayerSkuId when the variant has none', () => {
    const variant = toV1Variant({
      ...V2.variants[0],
      external_ids: { tcgplayer_sku: null },
    });

    expect('tcgplayerSkuId' in variant).toBe(false);
  });

  it('handles a variant with no markets at all', () => {
    const variant = toV1Variant({ ...V2.variants[0], markets: [] });

    expect(variant.price).toBeNull();
    expect(variant.priceChange24hr).toBeNull();
    expect(variant.priceHistory).toBeNull();
    expect(variant.id).toBe('pokemon-base-set-charizard-4_near-mint');
  });
});

describe('toV1Cards', () => {
  it('maps an array without passing the index in as options', () => {
    // The reason this helper exists: `[a, b].map(toV1Card)` would hand `1` to the options
    // parameter. Passing a region proves options still reach every element.
    const result = toV1Cards([V2, V2], { region: 'US' });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(V1);
    expect(result[1]).toEqual(V1);
  });

  it('returns an empty array for empty input', () => {
    expect(toV1Cards([])).toEqual([]);
  });
});

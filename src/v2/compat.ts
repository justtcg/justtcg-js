/**
 * Adapters that reshape a v2 card into the v1 shape.
 *
 * The point is to let an existing integration switch endpoints without touching its own downstream
 * types: fetch with `client.v2`, run the results through here, and keep every `Card`/`Variant` type
 * annotation you already have.
 *
 * Pure and dependency-free — nothing here performs I/O, so it is safe to use on cached or recorded
 * payloads too.
 */

import { Card, Condition, Variant } from '../types';
import { V2Card, V2Market, V2Period, V2PeriodWindow, V2Variant } from '../types/v2';

/**
 * How each v2 period statistic maps onto v1's flat field names.
 *
 * Exported so the mapping can be verified field-by-field rather than inferred. Two irregularities
 * are worth knowing about, both inherited from v1 and both deliberate:
 *
 * - the 7-day mean is `avgPrice`, not `avgPrice7d`
 * - `1y` carries only min/max, and `all_time` adds the dated extremes
 */
export const V1_PERIOD_FIELDS: {
  readonly [W in V2PeriodWindow]: Readonly<Partial<Record<keyof V2Period, keyof Variant>>>;
} = {
  '7d': {
    change_pct: 'priceChange7d',
    avg: 'avgPrice',
    min: 'minPrice7d',
    max: 'maxPrice7d',
    stddev: 'stddevPopPrice7d',
    cov: 'covPrice7d',
    iqr: 'iqrPrice7d',
    trend_slope: 'trendSlope7d',
    changes_count: 'priceChangesCount7d',
  },
  '30d': {
    change_pct: 'priceChange30d',
    avg: 'avgPrice30d',
    min: 'minPrice30d',
    max: 'maxPrice30d',
    stddev: 'stddevPopPrice30d',
    cov: 'covPrice30d',
    iqr: 'iqrPrice30d',
    trend_slope: 'trendSlope30d',
    changes_count: 'priceChangesCount30d',
    range_position: 'priceRelativeTo30dRange',
  },
  '90d': {
    change_pct: 'priceChange90d',
    avg: 'avgPrice90d',
    min: 'minPrice90d',
    max: 'maxPrice90d',
    stddev: 'stddevPopPrice90d',
    cov: 'covPrice90d',
    iqr: 'iqrPrice90d',
    trend_slope: 'trendSlope90d',
    changes_count: 'priceChangesCount90d',
    range_position: 'priceRelativeTo90dRange',
  },
  '1y': {
    min: 'minPrice1y',
    max: 'maxPrice1y',
  },
  all_time: {
    min: 'minPriceAllTime',
    max: 'maxPriceAllTime',
    min_date: 'minPriceAllTimeDate',
    max_date: 'maxPriceAllTimeDate',
  },
};

/** Options shared by every adapter in this module. */
export interface ToV1Options {
  /**
   * Which market to flatten into v1's single set of price fields. Defaults to `markets[0]`, the
   * primary market — the one `min_price` and `orderBy` were applied to.
   *
   * If you name a region the card has no entry for, the price fields come back `null` rather than
   * falling back to another region: silently handing you a different currency would be worse than
   * handing you nothing.
   */
  region?: string;
  /**
   * Whether to keep graded variants, with `condition` set to the canonical grade (`"PSA 10"`).
   * Defaults to `false`, which drops them — v1 is raw-only, so this reproduces what v1 returned.
   *
   * Turn it on only if your downstream code treats `condition` as a free-form string; it is not one
   * of the v1 {@link Condition} values.
   */
  includeGraded?: boolean;
}

/** Pick the market to flatten, honoring an explicit region request. */
function selectMarket(markets: V2Market[], region?: string): V2Market | undefined {
  if (region === undefined) return markets[0];
  return markets.find(market => market.region === region);
}

/**
 * Converts a single v2 variant to the v1 shape.
 *
 * A note on nullability: v1's {@link Variant} declares `price`, `lastUpdated`, `condition`, and
 * `printing` as non-nullable, but the v1 endpoint has always been able to send `null` for all four.
 * This adapter mirrors the wire rather than inventing placeholder values, so those fields are cast
 * — a `0` price would be indistinguishable from a real one.
 *
 * @param variant The v2 variant.
 * @param options Which market to flatten. See {@link ToV1Options}.
 */
export function toV1Variant(variant: V2Variant, options: ToV1Options = {}): Variant {
  const market = selectMarket(variant.markets, options.region);

  const result: Variant = {
    id: variant.slug,
    uuid: variant.id,
    condition: (variant.condition ?? variant.grading?.canonical ?? null) as Condition,
    printing: variant.printing as string,
    language: variant.language,
    price: (market?.price ?? null) as number,
    lastUpdated: (market?.updated_at ?? null) as number,
    priceChange24hr: market?.change_24h_pct ?? null,
    priceHistory: market?.price_history ?? null,
  };

  if (variant.external_ids.tcgplayer_sku !== null) {
    result.tcgplayerSkuId = variant.external_ids.tcgplayer_sku;
  }

  if (!market) return result;

  // One localized cast: the table is keyed by field name, so the loop cannot be typed without
  // enumerating every pair a second time — which is exactly what the table exists to avoid.
  const flat = result as unknown as Record<string, unknown>;
  for (const window of Object.keys(V1_PERIOD_FIELDS) as V2PeriodWindow[]) {
    const period = market.periods[window];
    if (!period) continue;

    const fields = V1_PERIOD_FIELDS[window];
    for (const key of Object.keys(fields) as (keyof V2Period)[]) {
      const value = period[key];
      // Absent means "not requested" in v2, and v1 omitted unrequested stats too — so skip rather
      // than writing an explicit null.
      if (value !== undefined) flat[fields[key] as string] = value;
    }
  }

  return result;
}

/**
 * Converts a v2 card to the v1 shape.
 *
 * ```ts
 * const { data } = await client.v2.cards.get({ game: 'pokemon' });
 * const legacy: Card[] = toV1Cards(data);
 * ```
 *
 * Two things do not round-trip, both harmless:
 *
 * - **`printing` loses the `" - <Language>"` suffix** v1 appended for non-English cards. v2 strips
 *   it because `language` already carries the same information, and re-appending it here would
 *   fabricate a suffix for cards that never had one.
 * - **Graded variants are dropped** unless `includeGraded` is set, because v1 never returned them.
 *
 * @param card The v2 card.
 * @param options Which market to flatten, and whether to keep graded variants.
 */
export function toV1Card(card: V2Card, options: ToV1Options = {}): Card {
  const variants = options.includeGraded
    ? card.variants
    : card.variants.filter(variant => variant.type !== 'graded');

  const result: Card = {
    // v2 promoted the UUID to `id` and moved the old v1 id to `slug`; v1 wants them the other way.
    id: card.slug,
    uuid: card.id,
    name: card.name,
    // v1's flat `game` is the display name, not the slug — `game.id` has no v1 home.
    game: card.game.name,
    set: card.set.id,
    number: card.number,
    rarity: card.rarity,
    tcgplayerId: card.external_ids.tcgplayer,
    scryfallId: card.external_ids.scryfall,
    mtgjsonId: card.external_ids.mtgjson,
    details: card.details,
    variants: variants.map(variant => toV1Variant(variant, options)),
  };

  if (card.set.name !== null) result.set_name = card.set.name;

  return result;
}

/**
 * Converts an array of v2 cards to the v1 shape.
 *
 * Prefer this over `cards.map(toV1Card)` — `Array.prototype.map` would pass the element index as
 * the options argument.
 *
 * @param cards The v2 cards.
 * @param options Which market to flatten, and whether to keep graded variants.
 */
export function toV1Cards(cards: V2Card[], options: ToV1Options = {}): Card[] {
  return cards.map(card => toV1Card(card, options));
}

/**
 * Types for the `/v2/cards` API (public beta).
 *
 * Mirrors the server contract in `cards-v2/types.v2.ts` and the request grammar in
 * `cards-v2/services/params.v2.service.ts`. v1 types in `./index.ts` are untouched — v2 is
 * strictly additive.
 *
 * A note on nullability, because it differs from v1: the v2 contract is **"absent ≠ null"**. A
 * field you did not request is omitted rather than sent as `null`, so most fields here are
 * optional rather than nullable. The deliberate exception is a market's `price`, which is `null`
 * when there is genuinely no local data for that region.
 */

import { QueryParams } from '../core/http-client';
import { Condition, ConditionAbv, Order, OrderBy } from './index';

// --- regions ---------------------------------------------------------------------------------

/** Coarse market buckets, each with one fixed aggregate currency. */
export type V2MarketCode = 'NA' | 'EU' | 'UK' | 'JP' | 'OCE' | 'LATAM' | 'OTHER';

/** ISO 3166-1 alpha-2 country codes the `regions` grammar accepts. */
export type V2CountryCode =
  | 'AR' | 'AT' | 'AU' | 'BE' | 'BR' | 'CA' | 'CL' | 'CO' | 'CZ' | 'DE' | 'DK' | 'ES' | 'FI'
  | 'FR' | 'GB' | 'IE' | 'IT' | 'JP' | 'MX' | 'NL' | 'NZ' | 'PE' | 'PL' | 'PT' | 'SE' | 'US';

/**
 * Every region code the `regions` parameter accepts.
 *
 * The vocabulary is frozen, but only some codes currently serve data — see
 * {@link V2_SERVICEABLE_REGIONS}. Requesting a valid-but-not-yet-live code returns a
 * `RegionNotAvailableError`.
 */
export type V2RegionCode = V2MarketCode | V2CountryCode;

/**
 * The regions that return data today. Every other valid code throws `RegionNotAvailableError`
 * until more regions come online.
 */
export const V2_SERVICEABLE_REGIONS = ['NA', 'US'] as const;

/**
 * The region used when `regions` is omitted: `US` (a country code, USD), which reproduces v1's
 * pricing. Note that `markets[0].region` echoes back the code that was actually used, so a request
 * that omits `regions` gets a market entry with `region: "US"`, not `"NA"`.
 */
export const V2_DEFAULT_REGION = 'US';

// --- grading ---------------------------------------------------------------------------------

/** The grading companies the API recognizes. */
export type V2GradingCompany = 'PSA' | 'BGS' | 'CGC' | 'BCCG' | 'BVG' | 'SGC';

/** How graded variants participate in the response. */
export type V2GradedMode =
  /** Raw variants only. The default, and the closest match to v1 behavior. */
  | 'exclude'
  /** Graded variants only. */
  | 'only'
  /**
   * Raw and graded variants together. Only available on a direct lookup (`card_id`/`variant_id`),
   * and carries a cost surcharge.
   */
  | 'include';

/** The structured grade on a graded variant. */
export interface V2Grading {
  /** The grading company, e.g. `PSA`. */
  company: string;
  /** The numeric grade, e.g. `9.5`. `null` only for cards graded "Authentic". */
  grade: number | null;
  /** A special designation such as `Black Label` or `Pristine`, when one applies. */
  grade_label: string | null;
  /** A grading qualifier such as `OC` (off-center). Cards with a qualifier are priced separately. */
  qualifier: string | null;
  /** A ready-to-display grade string, e.g. `PSA 10`. */
  canonical: string;
}

// --- pricing ---------------------------------------------------------------------------------

/** A single observed price point, in the enclosing market's currency. */
export interface V2PricePoint {
  /** Observation time, as a Unix timestamp in seconds. */
  t: number;
  /** The observed price, in dollars of the market's currency. */
  p: number;
}

/** The aggregate windows available under `markets[].periods`. */
export type V2PeriodWindow = '7d' | '30d' | '90d' | '1y' | 'all_time';

/** The windows available for `price_history`. Note there is no `180d` period window, and no
 * `all_time` price-history window — the two sets deliberately differ. */
export type V2PriceHistoryWindow = '7d' | '30d' | '90d' | '180d' | '1y';

/**
 * Per-window aggregate statistics, in the enclosing market's currency.
 *
 * Every field is optional: absent means the API did not compute or return it, which is distinct
 * from a value of zero. These carry the same values as v1's flat stat fields (`avgPrice30d`,
 * `minPrice7d`, …), regrouped by window.
 */
export interface V2Period {
  /** Percent change across the window. v1: `priceChange30d` and friends. */
  change_pct?: number;
  /** Mean price across the window. v1: `avgPrice30d` and friends. */
  avg?: number;
  /** Lowest observed price in the window. */
  min?: number;
  /** Highest observed price in the window. */
  max?: number;
  /** Population standard deviation of price. */
  stddev?: number;
  /** Coefficient of variation. */
  cov?: number;
  /** Interquartile range. */
  iqr?: number;
  /** Slope of the fitted price trend. */
  trend_slope?: number;
  /** Number of distinct price changes in the window. */
  changes_count?: number;
  /** Where the current price sits within the window's range. `30d` and `90d` only. */
  range_position?: number;
  /** ISO date of the all-time low. `all_time` only. */
  min_date?: string;
  /** ISO date of the all-time high. `all_time` only. */
  max_date?: string;
}

/**
 * Pricing for one region. There is one entry per region you requested, in the order you requested
 * them, and `markets[0]` is your **primary market** — `min_price` and `orderBy` apply to it only.
 *
 * Prices are never converted between currencies: a market's `price` is the real price observed in
 * that region, or `null` if there is no local data. If you want a USD fallback, request `US` or
 * `NA` as an extra region and read that entry.
 */
export interface V2Market {
  /** The region code this entry is for, echoing one you requested. */
  region: string;
  /** ISO 4217 currency of `price` and every `periods` value. */
  currency: string;
  /** The observed price in this region. `null` means no local data — never a converted price. */
  price: number | null;
  /** When `price` was last observed, as a Unix timestamp in seconds. */
  updated_at: number | null;
  /** Percent change over the last 24 hours in this region. v1: `priceChange24hr`. */
  change_24h_pct: number | null;
  /** Aggregate statistics keyed by window. Only the windows you requested are present. */
  periods: Partial<Record<V2PeriodWindow, V2Period>>;
  /** The observed price series for this region, windowed. v1: `priceHistory`. */
  price_history: V2PricePoint[];
}

// --- cards & variants ------------------------------------------------------------------------

/** A specific version of a card — either a raw copy in a given condition, or a graded slab. */
export interface V2Variant {
  /** The stable variant UUID. In v1 this field held the slug; the slug is now `slug`. */
  id: string;
  /** The legacy v1 variant id (a slug). */
  slug: string;
  /** Discriminates the two kinds of variant. */
  type: 'raw' | 'graded';
  /** The condition, e.g. `Near Mint`. Set for raw variants; `null` for graded. */
  condition: string | null;
  /**
   * The print type, e.g. `Holofoil`. Unlike v1 this no longer carries a `" - <Language>"` suffix —
   * read `language` separately.
   */
  printing: string | null;
  /** The language of this variant, when applicable. */
  language: string | null;
  external_ids: {
    /** The TCGplayer SKU for this variant. v1: `tcgplayerSkuId`. */
    tcgplayer_sku: string | null;
  };
  /** The structured grade. Populated for graded variants; `null` for raw. */
  grading: V2Grading | null;
  /** Pricing per requested region. `markets[0]` is the primary market. */
  markets: V2Market[];
}

/** A single trading card, with its variants. */
export interface V2Card {
  /** The stable card UUID. In v1 this field held the slug; the slug is now `slug`. */
  id: string;
  /** The legacy v1 card id (a slug). */
  slug: string;
  /** The name of the card. */
  name: string;
  /** The game this card belongs to, as both slug and display name. v1: `game` (a string). */
  game: { id: string; name: string };
  /** The set this card belongs to. v1: `set` (an id) plus `set_name`. */
  set: { id: string; name: string | null };
  /** The card number within its set. */
  number: string | null;
  /** The rarity of the card. */
  rarity: string | null;
  /** Third-party identifiers, nested in v2. v1: flat `tcgplayerId` / `scryfallId` / `mtgjsonId`. */
  external_ids: {
    tcgplayer: string | null;
    scryfall: string | null;
    mtgjson: string | null;
  };
  /** Additional details about the card. */
  details: string | null;
  /** The variants of this card — raw, graded, or both, depending on `graded`. */
  variants: V2Variant[];
}

// --- request params --------------------------------------------------------------------------

/**
 * A component to expand, optionally narrowed to one window: `periods`, `periods.30d`,
 * `price_history`, `price_history.90d`.
 *
 * Passing `include` **replaces** the default set rather than adding to it. The default is
 * `periods` (all windows) plus `price_history.7d`, so `include: ['price_history']` drops periods.
 */
export type V2IncludeComponent =
  | 'periods'
  | `periods.${V2PeriodWindow}`
  | 'price_history'
  | `price_history.${V2PriceHistoryWindow}`;

/**
 * The named parameters for `GET /v2/cards`.
 *
 * Note the casing: v2 uses snake_case for identifiers and filters (`card_id`, `min_price`), but
 * kept `orderBy` camelCase from v1.
 *
 * This carries no index signature, so `Omit`/`Pick` over it behave as expected. The wire-ready
 * variant is {@link GetV2CardsParams}.
 */
export interface V2CardsParams {
  /** Look up one card directly. Accepts a UUID or a legacy v1 slug. */
  card_id?: string;
  /** Look up one variant directly. The fastest lookup. Accepts a UUID or a legacy slug. */
  variant_id?: string;
  /**
   * Region codes in priority order; the first is your primary market. Defaults to
   * {@link V2_DEFAULT_REGION}. Each region beyond the first adds to the request cost.
   */
  regions?: readonly V2RegionCode[];
  /** Which kinds of variant to return. Defaults to `exclude` (raw only). */
  graded?: V2GradedMode;
  /**
   * Return grades from a single grading company. Implies `graded: 'only'` unless you also pass
   * `graded: 'include'`; combining it with `graded: 'exclude'` is an error.
   */
  grading_company?: V2GradingCompany;
  /**
   * Narrow to specific grades, e.g. `[9.5, 10]` or `['Authentic']`. Requires `grading_company` —
   * a grade alone cannot be resolved to a canonical seed.
   */
  grade?: readonly (string | number)[];
  /** Which components to expand. Replaces the default set entirely. */
  include?: readonly V2IncludeComponent[];
  /** Free-text search against the card name. */
  q?: string;
  /** Limit results to a single game. */
  game?: string;
  /** Limit results to a single set. */
  set?: string;
  /** Filter by card number within the set. */
  number?: string;
  /** Only return variants updated after this Unix timestamp (seconds). Cannot be combined with `q`. */
  updated_after?: number;
  /** Filter to these conditions. */
  condition?: readonly (Condition | ConditionAbv)[];
  /** Filter to these print types. */
  printing?: readonly string[];
  /** Only return cards priced at or above this value, read from the primary market. */
  min_price?: number;
  /** Sort direction. Defaults to `desc`. */
  order?: Order;
  /** Field to sort by, applied to the primary market only. Defaults to `price`. */
  orderBy?: OrderBy;
  /** Results per page. Defaults to 20; the maximum depends on your plan. */
  limit?: number;
  /** The opaque pagination cursor from the previous response. Replaces v1's `offset`. */
  cursor?: string;
}

/**
 * {@link V2CardsParams} with the index signature that lets it be serialized onto a query string.
 *
 * Prefer `V2CardsParams` when deriving new types — `Omit` over an index-signature type keeps the
 * signature and drops the named properties, which would silently make the result accept anything.
 */
export interface GetV2CardsParams extends V2CardsParams, QueryParams {}

/** Options for the v2 `search` convenience method — the filters, minus the query itself. */
export type V2SearchOptions = Omit<V2CardsParams, 'q' | 'card_id' | 'variant_id'>;

/**
 * Options for a direct lookup.
 *
 * Narrower than {@link V2SearchOptions}: the list-shaping parameters (`limit`, `cursor`, `order`,
 * `orderBy`, `min_price`) and the search filters (`game`, `set`, `number`, `updated_after`) have no
 * meaning when you have already named the exact card.
 */
export type V2RetrieveOptions = Omit<
  V2CardsParams,
  | 'card_id'
  | 'variant_id'
  | 'q'
  | 'game'
  | 'set'
  | 'number'
  | 'updated_after'
  | 'min_price'
  | 'order'
  | 'orderBy'
  | 'limit'
  | 'cursor'
>;

/**
 * One item in a `POST /v2/cards` batch body.
 *
 * The body grammar is inherited verbatim from v1 — including its camelCase keys — so v1 batch
 * payloads migrate with no changes. Batch always returns raw variants; graded is direct-only.
 */
export interface V2BatchLookupItem {
  /** A TCGplayer product ID. */
  tcgplayerId?: string;
  /** The TCGplayer SKU of a specific variant. */
  tcgplayerSkuId?: string;
  /** A JustTCG card ID or UUID. */
  cardId?: string;
  /** A JustTCG variant ID or UUID. */
  variantId?: string;
  /** The Scryfall ID of the card. */
  scryfallId?: string;
  /** The MTGJSON ID of the card. */
  mtgjsonId?: string;
  /** Filter to these print types. */
  printing?: string[];
  /** Filter to these conditions. */
  condition?: (Condition | ConditionAbv)[];
  /** Whether to include price history for this item. */
  include_price_history?: boolean;
  /** The price-history window for this item. */
  priceHistoryDuration?: V2PriceHistoryWindow;
}

/** Options for a v2 batch request. `regions` is sent as a query parameter, never per item. */
export interface V2BatchOptions {
  /** Region codes in priority order. Defaults to {@link V2_DEFAULT_REGION}. */
  regions?: readonly V2RegionCode[];
}

// --- responses -------------------------------------------------------------------------------

/** The raw `/v2/cards` response body. Always an array, including for direct lookups. */
export interface V2CardsResponseBody {
  data: V2Card[];
  /** Result-count metadata. Present on browse/search responses; absent is treated as unknown. */
  meta?: {
    /** Number of results in this page. */
    count?: number;
    /** Total number of results across all pages. */
    total?: number;
    has_more?: boolean;
  };
}

/**
 * Cursor pagination, parsed from the RFC 8288 `Link` header plus the response body's `meta`.
 */
export interface V2Pagination {
  /** Pass as `cursor` to fetch the next page. Absent on the last page. */
  nextCursor?: string;
  /** Pass as `cursor` to fetch the previous page. Absent on the first page. */
  prevCursor?: string;
  /** Whether a next page exists. */
  hasMore: boolean;
  /** Number of results in this page, from `meta.count`. */
  count?: number;
  /** Total number of results across all pages, from `meta.total` (falls back to the
   *  `X-Total-Count` header if the body omits `meta`). */
  total?: number;
}

/**
 * API usage, parsed from the `RateLimit-*` response headers.
 *
 * This is deliberately narrower than v1's {@link UsageMeta}: v2 moved usage out of the body and
 * into headers, which do not carry the plan name or the daily-used counters. Fields are optional
 * because a response may omit the headers.
 */
export interface V2UsageMeta {
  /** Maximum requests allowed in the current billing cycle. */
  limit?: number;
  /** Requests remaining in the current billing cycle. */
  remaining?: number;
  /** Seconds until the quota window resets. */
  reset?: number;
  /** The raw `RateLimit-Policy` header, e.g. `"daily";q=1000;w=86400`. */
  policy?: string;
}

/** The structured response the v2 SDK methods return. */
export interface V2ApiResponse<T> {
  /** The main data payload. */
  data: T;
  /** Cursor pagination, present for browse and search responses. */
  pagination?: V2Pagination;
  /** API usage, from the response headers. */
  usage: V2UsageMeta;
}

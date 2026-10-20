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
import { Condition, ConditionAbv, Order, CardLanguage, PriceStatus } from './index';

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
 * The regions that return data today: `NA` and its country code `US`, which serve the same USD
 * prices. Every other valid code throws `RegionNotAvailableError` until more regions come online.
 */
export const V2_SERVICEABLE_REGIONS = ['NA', 'US'] as const;

/**
 * The region the API uses when `regions` is omitted, as echoed in `markets[0].region`.
 *
 * The docs and OpenAPI give the default as `NA`, but the live API (checked 2026-10-20) echoes
 * `"US"` for a request without `regions`. The prices are identical either way: both are v1's USD
 * pricing. Code that matches on the region should accept both, or pass `regions` explicitly so the
 * echo is predictable (`regions: ['NA']` echoes `"NA"`).
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
 *
 * Which fields appear depends on the window:
 *
 * - `7d`, `30d`, `90d`: the full set, plus `range_position` on `30d` and `90d`
 * - `1y`: `min`, `max` and `sales_count` only
 * - `all_time`: `min`, `max`, `sales_count`, `min_date` and `max_date` only
 *
 * A window with no sales is omitted from `periods` entirely, so a missing window you requested
 * means zero sales — `sales_count` is never `0`.
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
  /**
   * Number of sales in the window — sales, not units, excluding refunded and voided sales. Always
   * at least 1 when present; a window with no sales is omitted rather than reporting `0`. Every
   * window carries it. No v1 equivalent, so `toV1Variant` drops it.
   */
  sales_count?: number;
  /**
   * Number of times the sale price changed in the window: five sales at the same price count 0.
   * Never more than `sales_count`. Before 2026-10-19 the API sent the sales count here instead.
   * v1: `priceChangesCount30d` and friends.
   */
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
 * them, and `markets[0]` is your **primary market** — `min_price` and `order_by` apply to it only.
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
  /**
   * The observed price in this region. `null` means no current local market report — never a
   * converted price. `price_status` says why.
   */
  price: number | null;
  /**
   * Why `price` is what it is: `'current'`, `'expired'` (the last price aged out, see `last_price`)
   * or `'unpriced'` (never priced). Graded variants are only ever `'current'` or `'unpriced'`.
   * v1: `priceStatus`. See https://justtcg.com/docs/thin-markets.
   */
  price_status: PriceStatus;
  /**
   * The last observed price, in `currency`, when `price_status` is `'expired'`; `null` otherwise.
   * v1: `lastKnownPrice`.
   */
  last_price: number | null;
  /**
   * When `price` was last observed, as a Unix timestamp in seconds. For an expired market this is
   * when the last price was seen.
   */
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
 * The fields v2 can sort by, always read from the primary market (`markets[0]`).
 *
 * Narrower than v1's `OrderBy`: v2 has no `90d` sort.
 */
export type V2OrderBy = 'price' | '24h' | '7d' | '30d';

/**
 * The named parameters for `GET /v2/cards`.
 *
 * Note the casing: v2 uses snake_case for every identifier, filter, and sort param (`card_id`,
 * `min_price`, `order_by`) — as of 2026-07-29 there is no remaining camelCase holdover from v1.
 *
 * This carries no index signature, so `Omit`/`Pick` over it behave as expected. The wire-ready
 * variant is {@link GetV2CardsParams}.
 */
export interface V2CardsParams {
  /** Look up one card directly. Accepts a UUID or a legacy v1 slug. */
  card_id?: string;
  /** Look up one variant directly. The fastest lookup. Accepts a UUID or a legacy slug. */
  variant_id?: string;
  /** Look up one card by its TCGplayer product ID. v1: `tcgplayerId`. */
  tcgplayer_id?: string;
  /** Look up one variant by its TCGplayer SKU ID. v1: `tcgplayerSkuId`. */
  tcgplayer_sku_id?: string;
  /**
   * Look up sealed product by its retail barcode: a 12-digit UPC-A, 13-digit EAN-13 or JAN, 8-digit
   * EAN-8, or 14-digit GTIN-14. Spaces and hyphens are ignored.
   *
   * One barcode can match several listings, so `data` may hold more than one card. An invalid
   * check digit is a `ValidationError`; a valid code nobody carries is a `NotFoundError`. Cannot be
   * combined with `graded`. Coverage is currently sealed Magic: The Gathering, Pokémon and
   * Yu-Gi-Oh! product.
   *
   * When several identifiers are sent, the most specific wins: `variant_id`, `tcgplayer_sku_id`,
   * `tcgplayer_id`, `card_id`, then `gtin` last.
   */
  gtin?: string;
  /**
   * Region codes in priority order; the first is your primary market. When omitted the API uses
   * {@link V2_DEFAULT_REGION} (documented as `NA`; same prices either way). Each region beyond the first adds to the request cost.
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
  /**
   * Free-text search against the card name. A 12–14 digit barcode is matched as a `gtin` first,
   * then falls back to a name search if no product carries it.
   */
  q?: string;
  /** Limit results to a single game. */
  game?: string;
  /** Limit results to a single set. */
  set?: string;
  /** Filter by card number within the set. */
  number?: string;
  /**
   * Only return variants updated after this Unix timestamp (seconds). Cannot be combined with `q`.
   *
   * A price expiry counts as an update, so an expired market is returned once with a `null` `price`
   * and `price_status: 'expired'`.
   */
  updated_after?: number;
  /** Filter to these conditions. */
  condition?: readonly (Condition | ConditionAbv)[];
  /** Filter to these print types. */
  printing?: readonly string[];
  /** Only return cards priced at or above this value, read from the primary market. */
  min_price?: number;
  /**
   * Sort direction. Defaults to `desc`. The OpenAPI spec doesn't list it, but the live API still
   * accepts and validates it.
   */
  order?: Order;
  /** Field to sort by, applied to the primary market only. Defaults to `price`. */
  order_by?: V2OrderBy;
  /** Results per page. Defaults to 20; the maximum depends on your plan. */
  limit?: number;
  /** The opaque pagination cursor from the previous response. Replaces v1's `offset`. */
  cursor?: string;
  /**
   * Narrows each card's `variants[]` to the requested language(s) after grouping.
   * Never drops a card — a card with no matching variants is returned with an
   * empty `variants[]`. Pagination counts (`meta.total`) are unaffected.
   *
   * Accepted values (case-insensitive on the wire):
   * `"English"`, `"Japanese"`, `"French"`, `"German"`, `"Spanish"`, `"Italian"`,
   * `"Chinese (S)"`, `"Portuguese"`, `"Chinese (T)"`, `"Russian"`, `"Korean"`.
   *
   * Note: variants with `language: null` in the database resolve to `"English"`.
   *
   * Ignored for single-variant lookups (`variant_id` / `retrieveVariant`), which always return
   * the one variant asked for.
   *
   * @example
   * client.v2.cards.get({ game: 'pokemon', language: ['Japanese'] })
   */
  language?: readonly (CardLanguage | string)[];
}

/**
 * {@link V2CardsParams} with the index signature that lets it be serialized onto a query string.
 *
 * Prefer `V2CardsParams` when deriving new types — `Omit` over an index-signature type keeps the
 * signature and drops the named properties, which would silently make the result accept anything.
 */
export interface GetV2CardsParams extends V2CardsParams, QueryParams {}

/** The `GET /v2/cards` params that name one card, variant or product directly. */
type V2IdentifierParam = 'card_id' | 'variant_id' | 'tcgplayer_id' | 'tcgplayer_sku_id' | 'gtin';

/** Options for the v2 `search` convenience method — the filters, minus the query itself. */
export type V2SearchOptions = Omit<V2CardsParams, 'q' | V2IdentifierParam>;

/**
 * Options for a direct lookup.
 *
 * Narrower than {@link V2SearchOptions}: the list-shaping parameters (`limit`, `cursor`, `order`,
 * `order_by`, `min_price`) and the search filters (`game`, `set`, `number`, `updated_after`) have no
 * meaning when you have already named the exact card.
 */
export type V2RetrieveOptions = Omit<
  V2CardsParams,
  | V2IdentifierParam
  | 'q'
  | 'game'
  | 'set'
  | 'number'
  | 'updated_after'
  | 'min_price'
  | 'order'
  | 'order_by'
  | 'limit'
  | 'cursor'
>;

/**
 * Options for a barcode lookup. The same as {@link V2RetrieveOptions} minus the grading params:
 * the API rejects `gtin` combined with `graded`, and barcodes only cover sealed product anyway.
 */
export type V2BarcodeLookupOptions = Omit<V2RetrieveOptions, 'graded' | 'grading_company' | 'grade'>;

/**
 * One item in a `POST /v2/cards` batch body.
 *
 * As of 2026-07-29 the body grammar is snake_case, matching every other v2 param — this reversed
 * an earlier decision to keep v1's camelCase keys for zero-change migration. A body built against
 * the pre-2026-07-29 shape (`cardId`, `tcgplayerId`, …) will no longer resolve any identifier and
 * the API 400s.
 *
 * Each item must name at least one identifier. When it names several, the most specific wins:
 * `variant_id`, `tcgplayer_sku_id`, `tcgplayer_id`, `mtgjson_id`, `scryfall_id`, `card_id`.
 *
 * Request-wide parameters (`include`, `updated_after`, `regions`) belong in {@link V2BatchOptions},
 * not on an item — a per-item `updated_after` is rejected with a `400`. Batch does not accept
 * `graded`, `grading_company` or `grade`: a graded variant comes back only when it already has a
 * price and is named by `variant_id`. Use a direct lookup to request a specific grade.
 */
export interface V2BatchLookupItem {
  /** A TCGplayer product ID. */
  tcgplayer_id?: string;
  /** The TCGplayer SKU of a specific variant. */
  tcgplayer_sku_id?: string;
  /** A JustTCG card ID or UUID. */
  card_id?: string;
  /** A JustTCG variant ID or UUID. */
  variant_id?: string;
  /** The Scryfall ID of the card. */
  scryfall_id?: string;
  /** The MTGJSON ID of the card. */
  mtgjson_id?: string;
  /** Filter to these print types. */
  printing?: string[];
  /** Filter to these conditions. */
  condition?: (Condition | ConditionAbv)[];
  /**
   * Whether to include price history for this item. `false` returns an empty `price_history`.
   *
   * Not part of the documented v2 batch body, but still honoured by the API (checked live
   * 2026-10-20). Prefer `include` in {@link V2BatchOptions}, which applies to the whole batch.
   */
  include_price_history?: boolean;
  /**
   * The price-history window for this item. Overrides the window of a request-wide
   * `include: ['price_history.<window>']`, but cannot bring history back when the request-wide
   * `include` leaves `price_history` out.
   *
   * Not part of the documented v2 batch body, but still honoured by the API (checked live
   * 2026-10-20). Prefer `include` in {@link V2BatchOptions}, e.g. `['price_history.90d']`.
   */
  price_history_duration?: V2PriceHistoryWindow;
}

/**
 * Options for a v2 batch request. Every field is sent on the query string and applies to the whole
 * batch, never per item.
 */
export interface V2BatchOptions {
  /** Region codes in priority order. Defaults to {@link V2_DEFAULT_REGION}. */
  regions?: readonly V2RegionCode[];
  /**
   * Which components to expand on every returned card. Replaces the default set entirely, as on
   * `GET /v2/cards`.
   */
  include?: readonly V2IncludeComponent[];
  /**
   * Only return variants updated after this Unix timestamp (seconds). Must be set here rather than
   * per item; a per-item `updated_after` is rejected with a `400`.
   */
  updated_after?: number;
}

// --- responses -------------------------------------------------------------------------------

/**
 * The raw `GET /v2/cards` and `POST /v2/cards` response body. Always an array, including for a
 * `card_id`/`variant_id` lookup on the list endpoint.
 */
export interface V2CardsResponseBody {
  data: V2Card[];
  /** Pagination metadata. Present on browse/search responses; absent is treated as unknown. */
  meta?: V2PaginationMeta;
}

/**
 * The raw `GET /v2/cards/{id}` response body. There is never a `meta`.
 *
 * The spec documents `data` as a single card. The live API still sends a one-element array, so the
 * SDK accepts both.
 */
export interface V2CardResponseBody {
  data: V2Card | V2Card[];
}

/** The raw `meta` object of a `/v2/cards` response body. */
export interface V2PaginationMeta {
  /** Number of results in this page. */
  count?: number;
  /** Total number of results across all pages. `null` means unknown, not zero. */
  total?: number | null;
  /** The page size applied to this request. */
  limit?: number;
  /** Whether a next page exists. */
  has_more?: boolean;
  /** Opaque cursors for the adjacent pages. The API keeps these in agreement with `Link`. */
  cursor?: {
    /** Cursor for the next page; `null` on the last page. */
    next?: string | null;
    /** Cursor for the previous page; `null` on the first page. */
    prev?: string | null;
  };
}

/**
 * Cursor pagination, parsed from the response body's `meta`, with the RFC 8288 `Link` header as
 * the cursor fallback.
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
   *  `X-Total-Count` header if the body omits `meta`). Absent when the total is unknown. */
  total?: number;
  /** The page size applied to this request, from `meta.limit`. */
  limit?: number;
}

/**
 * API usage, parsed from the rate-limit response headers: either the combined
 * `RateLimit: limit=…, remaining=…, reset=…` header documented in the OpenAPI spec, or the
 * separate `RateLimit-Limit` / `-Remaining` / `-Reset` headers the live API currently sends.
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
  /** The raw `RateLimit-Policy` header when sent, e.g. `"daily";q=1000;w=86400`. */
  policy?: string;
}

/** The structured response the v2 SDK methods return. */
export interface V2ApiResponse<T> {
  /** The main data payload. */
  data: T;
  /**
   * Cursor pagination, present for browse and search responses. On a batch response only `count`
   * is set (and `hasMore` is always `false`).
   */
  pagination?: V2Pagination;
  /** API usage, from the response headers. */
  usage: V2UsageMeta;
}

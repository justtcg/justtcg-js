# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`SubscriptionRequiredError`** (extends `AuthenticationError`) for `403 SUBSCRIPTION_REQUIRED`,
  returned when an API key is valid but its plan is not active. `reactivateUrl` carries
  `details.reactivate_url`, the link that resubscribes to that plan. Mapped from both the v1
  `{ error, code, details }` body and the v2 `problem+json` body. Existing
  `instanceof AuthenticationError` checks still catch it.

- **`sales_count` on v2 periods.** Every `markets[].periods.<window>` (`7d`, `30d`, `90d`, `1y`,
  `all_time`) now carries `sales_count`: the number of sales (not units) in the window, excluding
  refunded and voided sales. It is always at least 1; a window with no sales is omitted, so a
  missing window means zero. It follows `include=periods[.<window>]` like the other stats. v1 has
  no equivalent field, so `toV1Card`/`toV1Variant` drop it.

### Fixed

- **`client.v2.cards.retrieve()` now calls the canonical direct lookup `GET /v2/cards/{id}`**
  instead of `GET /v2/cards?card_id=…`. The id is URL-encoded into the path. Its signature,
  return type and `NotFoundError` behaviour are unchanged. The spec documents `data` as a single
  card object, but the live API still sends a one-element array, so both shapes are accepted.
  `retrieveVariant()` stays on `?variant_id=`, because there is no variant path.
- **v2 `order_by` is typed as the new `V2OrderBy`** (`'price' | '24h' | '7d' | '30d'`), the enum
  the v2 spec documents, instead of v1's `OrderBy`. A `'90d'` sort on v2 is now a type error. The
  live API still accepts `90d`, but the spec does not, so it isn't supported. v1's `OrderBy` is
  unchanged.
- **v2 region docs now describe what the API actually does.** The docs and OpenAPI say `regions`
  defaults to `NA`, but a request without `regions` is still echoed as `markets[0].region: "US"`
  (checked live on 2026-10-20). `V2_DEFAULT_REGION` therefore stays `'US'`, and
  `V2_SERVICEABLE_REGIONS` stays `['NA', 'US']`, the codes the API reports as live. The prices are
  identical either way. Pass `regions: ['NA']` if your code matches on the region code.
- The v2 `language` doc comment now notes that `language` is ignored for `variant_id` lookups.
  `order` remains supported on v2: the spec no longer lists it, but the live API still validates
  it and applies it.

- **v2 errors now map the documented `problem+json` shape.** The spec gives `type` as a docs
  anchor (`https://justtcg.com/docs/errors#invalid-request`) plus a `code` member with the v1
  codes. The SDK used to read only the last path segment of `type`, so documented bodies all fell
  back to status-only mapping: `RegionNotAvailableError` never fired and
  `ValidationError.parameter` was dropped.
  - The problem slug is now taken from the URI fragment, falling back to the last path segment.
    The `https://api.justtcg.com/problems/<slug>` URIs the live API sends today still map as
    before.
  - `JustTCGError.code` is the body's `code` (e.g. `INVALID_REQUEST`) when present, so v1 and v2
    errors share one vocabulary. Without a `code` member it is still the slug. The full body
    stays on `error.problem`.
  - `invalid-request` maps to `ValidationError`, and `parameter` is kept on any 400 problem,
    including types the SDK does not recognise.

- **v2 `usage` and `pagination` now follow the documented response contract.**
  - `usage` also reads the combined `RateLimit: limit=…, remaining=…, reset=…` header documented
    in the OpenAPI spec (comma-separated `key=value` pairs; spacing, quotes and key case are
    tolerated). The separate `RateLimit-Limit` / `-Remaining` / `-Reset` headers, which the live
    API sends today, remain the fallback, and `RateLimit-Policy` is still passed through as
    `usage.policy`. Before this, a response carrying only the combined header returned empty
    `usage`.
  - `pagination` takes `nextCursor` / `prevCursor` from the body's `meta.cursor` and `hasMore`
    from `meta.has_more`, with the `Link` header as the fallback when the body has no cursor
    object.
  - `meta.total: null` (total unknown) now maps to `pagination.total` being absent instead of
    leaking `null`. The `X-Total-Count` fallback is unchanged.
  - New `pagination.limit` field from `meta.limit`. The body `meta` type is now exported as
    `V2PaginationMeta`, including `limit` and `cursor: { next, prev }`.

- **`V2Period.changes_count` is documented with its corrected meaning.** Since 2026-10-19 the API
  sends the number of times the sale price changed in the window (five sales at one price count
  0, and it never exceeds `sales_count`). Before that it equalled the sales count. It now matches
  v1's `priceChangesCount*` exactly, which is what the compat adapters already map it to. The
  `V2Period` docs also list which fields each window carries.

## [0.4.0] - 2026-08-06

### Changed (breaking, v2 only)

- **v2 request grammar is now fully snake_case.** Two holdovers from v1's camelCase are gone:
  - `GetV2CardsParams.orderBy` → `order_by`.
  - `V2BatchLookupItem` fields (`cardId`, `tcgplayerId`, `tcgplayerSkuId`, `variantId`,
    `scryfallId`, `mtgjsonId`, `priceHistoryDuration`) → `card_id`, `tcgplayer_id`,
    `tcgplayer_sku_id`, `variant_id`, `scryfall_id`, `mtgjson_id`, `price_history_duration`.
  - A batch body built against the old (pre-this-release) shape silently resolves no identifier
    per item and the API returns `400`; there is no dual-case transition window. `client.v1` is
    unaffected — its camelCase grammar is permanent.
  - Matches the corresponding backend change in `cards-v2` (2026-07-29).

## [0.3.0] - 2026-07-22

### Added

- **v2 API (public beta)** under `client.v2`, alongside the unchanged `client.v1`.
  - `client.v2.cards.get()` / `.search()` — browse, filter, and search, returning the familiar
    `{ data, pagination, usage }` envelope with cursor-based pagination.
  - `client.v2.cards.retrieve()` / `.retrieveVariant()` — direct lookup by UUID or legacy v1 slug,
    unwrapping the single card. `retrieve()` accepts `graded: 'include'`.
  - `client.v2.cards.getByBatch()` — batch lookup; the v1 body grammar is unchanged, so existing
    payloads migrate as-is.
  - `client.v2.cards.iterate()` / `.iteratePages()` — async generators that walk every page over
    cursors, lazily.
- **Localized pricing** — request `regions: ['UK', 'US']` and read per-region entries from
  `markets[]`. Prices are the real local prices and are never currency-converted.
- **Graded cards** — returned as ordinary variants discriminated by `type: 'graded'` with a
  structured `grading` object.
- **`toV1Card` / `toV1Cards` / `toV1Variant`** compat adapters that reshape v2 results into the v1
  `Card` shape, so an existing integration can switch endpoints without changing its own types.
- **Typed error classes** (`JustTCGError` and subclasses `AuthenticationError`, `ValidationError`,
  `RegionNotAvailableError`, `NotFoundError`, `RateLimitError`, `ApiError`), exported for
  `instanceof` branching. Mapped from the API's `application/problem+json` responses.
- v2 usage is parsed from the `RateLimit-*` response headers and pagination from the RFC 8288
  `Link` header.
- Examples: `v2-quickstart.ts`, `v2-iterate-and-graded.ts`, `v2-migrate-from-v1.ts`.

### Changed

- `HttpClient` now exposes the response headers and status internally (via `getRaw`/`postRaw`),
  needed for v2's header-based usage and pagination. The existing `get()`/`post()` signatures are
  unchanged, and all v1 behavior is byte-for-byte identical.
- v1 request failures now throw a `JustTCGError` subclass (which extends `Error`) instead of a bare
  `Error`. Existing `catch (e) { e.message }` handling is unaffected; the `error`/`code` response
  properties are unchanged.

### Notes

- v2 is a **public beta**. `client.v1` is untouched — every v1 type, id, and response shape is
  preserved.
- External-id GET parameters (`tcgplayerId`, `scryfallId`, …) are not yet available on the v2 `get`
  endpoint; use `getByBatch` or `client.v1` for those lookups in the meantime.

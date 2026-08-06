# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

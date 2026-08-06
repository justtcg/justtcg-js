# justtcg-js — `/v2/cards` Integration Plan

Status: proposal · Target SDK version: **0.3.0** · API: `/v2/cards` (public beta)

## 0. Guiding constraint

**`src/v1/**` and `src/types/index.ts` are frozen.** Every existing integration
(`client.v1.cards.get(...)` → `{ data, pagination, usage }`) must keep compiling and behaving
identically. v2 ships as an additive namespace: `client.v2.cards`. No default-version switch, no
renamed exports, no changed return shapes in 0.3.0.

---

## 1. What actually changed on the wire

Sources: `cards-v2/types.v2.ts`, `services/params.v2.service.ts`, `services/http.v2.ts`,
`services/mapper.v2.ts`, `handlers.ts`, and the public docs panel `V2Panel.tsx`.

### 1.1 Response body

```jsonc
{ "data": [ Card, ... ] }   // ALWAYS an array — direct lookups included
```

- No `_metadata` in the body. Usage moves to **`RateLimit-*` headers**.
- No `meta` block. Pagination moves to the **RFC 8288 `Link` header** with an opaque `cursor`.
- Errors are **`application/problem+json`** (RFC 9457): `{ type, title, status, detail, ...extra }`.

Card / variant shape (frozen, `types.v2.ts`):

| v1 | v2 |
|---|---|
| `id` (slug) | `id` = **UUID**, `slug` = old slug |
| `game: string`, `set: string`, `set_name` | `game: {id,name}`, `set: {id,name}` |
| `tcgplayerId` / `scryfallId` / `mtgjsonId` | `external_ids: { tcgplayer, scryfall, mtgjson }` |
| variant `tcgplayerSkuId` | variant `external_ids.tcgplayer_sku` |
| variant `price`, `lastUpdated`, `priceChange24hr`, `priceHistory` | inside **`markets[]`**: `price`, `updated_at`, `change_24h_pct`, `price_history` |
| ~40 flat stat fields (`avgPrice30d`, `minPrice7d`, …) | `markets[].periods["30d"].avg`, `.min`, … (windows `7d/30d/90d/1y/all_time`) |
| — | variant `type: "raw" \| "graded"`, `grading: {company,grade,grade_label,qualifier,canonical} \| null` |
| `printing` includes `" - <Language>"` suffix | suffix stripped; read `language` separately |

Contract detail worth encoding in types: **absent ≠ null.** Unrequested `periods` fields are
omitted, so every `V2Period` key is optional. The one field that is genuinely nullable is
`markets[].price`.

### 1.2 Request grammar

- snake_case query params: `card_id`, `variant_id`, `min_price`, `updated_after`, `grading_company`,
  `order_by` (renamed from v1's `orderBy` on 2026-07-29 — it was the last unconverted param).
  `order`, `limit`, `q`, `game`, `set`, `number` are single words, so v1/v2 spelling coincides.
- Preferred direct form is path-style: `GET /v2/cards/{identifier}`.
- `regions` — comma list, priority order, `markets[0]` is primary. Only `NA` and `US` are
  serviceable today; anything else in the vocabulary returns a `region-not-available` 400.
- `graded` = `exclude` (default) | `only` | `include`; `grading_company`; `grade` (comma list).
  `grade` without `grading_company` → 400. `graded=include` is **direct-lookup only**.
- `include=` replaces v1's `include_price_history` / `priceHistoryDuration` / `include_statistics`:
  `include=periods[.<window>],price_history[.<window>]`. Default = `periods` (all) + `price_history.7d`.
  An explicit `include` **replaces** the default set.
- `cursor` replaces `offset`. `limit` unchanged.
- Batch `POST /v2/cards` body is **snake_case** (`card_id`, `tcgplayer_id`, …) as of 2026-07-29 —
  the v1 camelCase body is no longer accepted. `regions` is read from the **query string**, never
  per item. Batch is always raw (graded excluded).

### 1.3 Gaps vs v1 the SDK must not paper over

- v2 `GET` accepts **only** `card_id` / `variant_id` for direct lookups. `tcgplayerId`,
  `tcgplayerSkuId`, `scryfallId`, `mtgjsonId` are **not** GET params in v2 (they still work in the
  batch body). See §6 — this needs a product answer before we finalize `GetV2CardsParams`.
- No `include_null_prices` in v2.
- No `total` anywhere: `Link` gives next/prev only. `pagination.total` cannot be provided.
- `RateLimit-*` headers carry `Limit`, `Remaining`, `Reset`, `Policy` — **less** than v1's
  `UsageMeta` (no `apiPlan`, no daily-used counters). v2 `usage` is necessarily a different type.

---

## 2. Target public surface

```ts
const client = new JustTCG({ apiKey });

// unchanged
await client.v1.cards.get({ query: 'Charizard', game: 'Pokemon' });

// new
const res = await client.v2.cards.get({ game: 'pokemon', set: 'base-set', limit: 50 });
res.data;             // V2Card[]
res.pagination;       // { nextCursor?, prevCursor?, hasMore }
res.usage;            // V2UsageMeta (from RateLimit headers)

await client.v2.cards.retrieve('907005b3-…');            // path-style, returns V2Card | null
await client.v2.cards.search('Charizard', { game: 'pokemon' });
await client.v2.cards.getByBatch([{ card_id: '…' }], { regions: ['NA'] });

for await (const card of client.v2.cards.iterate({ game: 'pokemon' })) { … }  // cursor auto-paging
```

Directory layout mirrors v1:

```
src/
  core/http-client.ts        (extended — see §3)
  errors/index.ts            (NEW — currently an empty dir)
  types/index.ts             (frozen; re-exports v2 types)
  types/v2.ts                (NEW)
  v1/…                       (untouched)
  v2/index.ts                (NEW — V2Client)
  v2/resources/base.ts       (NEW)
  v2/resources/cards.ts      (NEW)
  v2/compat.ts               (NEW — v2 → v1 shape adapter, §5)
```

---

## 3. Core changes (the only shared-code risk)

`HttpClient` today swallows headers and assumes `{ error }` bodies. It needs, **additively**:

1. **`request()` returning `{ body, headers, status }`.** Keep `get()`/`post()` as thin wrappers
   with identical signatures so v1 resources don't change at all.
2. **Query params on POST** (v2 batch needs `?regions=NA`). Today `post()` takes only a body.
3. **Raw body passthrough on POST.** The current `post()` hard-codes a v1 field allowlist and
   stringifies arrays. v2 batch reuses the same body grammar, so the allowlist mostly works — but
   it silently drops unknown keys. Add an opt-in `postRaw()` (or a `serialize` hook) for v2.
4. **Array param serialization**: v2 wants comma-joined (`regions=NA,US`, `grade=9.5,10`,
   `include=periods.30d,price_history`). The current `String(value)` on an array happens to produce
   comma-joined output — make that explicit rather than incidental.
5. **Error parsing**: branch on `Content-Type: application/problem+json` → throw the typed error
   from §4; otherwise fall back to today's `{ error, code }` path.

Regression guard: the existing `tests/v1/*.test.ts` must pass untouched. That is the acceptance
criterion for the `HttpClient` refactor.

---

## 4. Errors (`src/errors/` — currently empty)

Introduce a real hierarchy, used by **both** versions so v1 error handling improves without changing
its success shape:

```
JustTCGError (base: message, status)
  ├── AuthenticationError        401
  ├── ValidationError            400  (+ parameter?)
  ├── RegionNotAvailableError    400  (+ available: string[])
  ├── NotFoundError              404
  ├── RateLimitError             429  (+ retryAfter?)
  └── ApiError                   5xx / anything else
```

`problem.type` (`https://api.justtcg.com/problems/invalid-parameter`, `…/region-not-available`,
`…/not-found`, `…/internal-error`) maps 1:1 onto these. Every error carries `.problem` with the raw
body so nothing is lost.

Caveat: v1 currently throws bare `Error`. Making it throw `JustTCGError` (which `extends Error`) is
source-compatible for `catch (e) { e.message }` but is a behavior change worth a minor-version note.

---

## 5. Making migration seamless

Three layers, in increasing order of user effort:

**(a) Defaults that reproduce v1.** Send nothing extra: `graded` defaults to `exclude` and regions
defaults to a single USD market. A v2 call with no new params returns the same raw NA pricing v1
returned. The SDK must **not** inject its own `regions` default — let the server own it (see §6.1).

**(b) `toV1Card(v2Card, { region })` adapter** in `src/v2/compat.ts`. Pure, dependency-free,
exported publicly. Maps `id`→`slug`, hoists `markets[0]` (or the named region) into flat
`price`/`lastUpdated`/`priceChange24hr`/`priceHistory`, flattens `periods` back to the v1 stat field
names, re-nests `external_ids` and `game`/`set`. Lets an existing codebase switch endpoints while
keeping its own downstream types:

```ts
const { data } = await client.v2.cards.get({ game: 'pokemon' });
const legacy = data.map(toV1Card);   // typed as v1 `Card`
```

The flat-stats mapping table is the fiddly part; it should be a single exported const so it can be
unit-tested field-by-field against a recorded v1+v2 response pair for the same card.

**(c) A documented, mechanical migration table** in the README, matching §1.1 above and the
"What changes for an existing integration" list in the public docs.

Explicitly **not** doing: a `version: 'v2'` constructor flag that silently reroutes `client.v1`
calls. It would make `id` change meaning underneath working code — the exact opposite of seamless.

---

## 6. Resolved decisions

**The deployed code is the source of truth, not the docs panel.** Where the two disagree, follow
`cards-v2/`. (The docs were reference material for filling context gaps.)

1. **`regions` defaults to `US`** — `params.v2.service.ts` `DEFAULT_REGION`, not the `NA` the docs
   panel claims. Consequence: a request that omits `regions` gets back `markets[0].region === "US"`.
   Encoded as the exported `V2_DEFAULT_REGION` constant so users can key on it without guessing.
   The SDK does **not** inject its own default — the server owns it.
2. **External-id GET params are pending implementation**, not dropped. `tcgplayerId` /
   `tcgplayerSkuId` / `scryfallId` / `mtgjsonId` are therefore **absent from `GetV2CardsParams`**
   for now; they remain available in the batch body. Adding them later is purely additive, so no
   design accommodation is needed today. Until then, that entry point stays on v1.
3. **Use the query-param form, not path-style.** Direct lookups go to `/v2/cards?card_id=…` /
   `?variant_id=…`. `retrieve()` is built on that, so the `extractPathIdentifier` route is not
   exercised by the SDK and the docs' "single Card object when you look up by path" ambiguity is
   moot. Responses are always `{ data: V2Card[] }`.

### Still open (non-blocking)

4. **`apiPlan` / daily-usage counters** are absent from the `RateLimit-*` headers. Should v2 carry a
   `RateLimit-Policy` extension or a `JustTCG-Plan` header, or does `usage` legitimately shrink in v2?
5. **Batch + `Link`.** `handlers.ts` builds a Link header for batch too when `totalCount` is set.
   Is batch ever paginated, or should the SDK ignore Link on batch responses?
6. **Cost surcharges** (extra regions, `graded=include`) — "exact figures set at launch". Worth a
   README note; no code impact.

---

## 7. Phased delivery

| Phase | Scope | Exit criteria |
|---|---|---|
| **0** ✅ | Resolve §6.1–6.3 with the API team | Answers recorded in §6 |
| **1** ✅ | `HttpClient.request()` + headers + POST query params + problem+json branch; `src/errors/` | All existing v1 tests green, unmodified |
| **2** ✅ | `src/types/v2.ts` — hand-written from `types.v2.ts`, with `V2Period` fields all optional | `tsc` clean; types re-exported from root |
| **3** ✅ | `V2Client` + `V2CardsResource` (`get`, `search`, `retrieve`, `retrieveVariant`, `getByBatch`), header parsing for `usage` + `Link`/cursor | Unit tests with mocked `fetch` per lookup mode |
| **4** ✅ | `iterate()` / `iteratePages()` async generators over cursors | Test: 3-page walk terminates, no cursor reuse |
| **5** ✅ | `toV1Card` / `toV1Cards` / `toV1Variant` compat adapters, driven by the exported `V1_PERIOD_FIELDS` table | Field-by-field test against a recorded v1/v2 pair |
| **6** ✅ | README "Using v2" section + migration table, 3 `examples/v2-*.ts` | — |
| **7** ⏳ | Release `0.3.0`, README marked beta; CHANGELOG added | Awaiting maintainer commit + publish |

### Test strategy

> **Toolchain note:** the tests need Node ≥ 20.19 (vitest 3.2 + vite 7). The default `node` on this
> machine is 20.11 and fails at config load with `ERR_REQUIRE_ESM` before running anything — use
> `export PATH="$HOME/.nvm/versions/node/v24.8.0/bin:$PATH"`. Worth adding an `engines` field.

Mocked `fetch` throughout (v1 tests already do this) with **fixtures captured from live
`api.justtcg.com/v2/cards`** — one per lookup mode plus one graded, one problem+json, one
`Link`-paginated. No live calls in CI.

### Versioning

`0.3.0` minor. v2 surface documented as **beta**: it may take breaking changes in a minor while
`/v2/cards` is in beta, and that caveat lives in the README next to the v2 section. v1 stays under
normal semver.

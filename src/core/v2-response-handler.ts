import { V2Pagination, V2PaginationMeta, V2UsageMeta } from '../types/v2';

/**
 * v2 moved the usage metadata that v1 carried in the response body into `RateLimit` response
 * headers, and carries pagination in the body's `meta` mirrored by an RFC 8288 `Link` header.
 * These helpers turn both back into the structured shapes the SDK returns.
 */

/** Parse a string as an integer, ignoring absent or malformed values. */
function intValue(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Parse a header as an integer, ignoring absent or malformed values. */
function intHeader(headers: Headers, name: string): number | undefined {
  return intValue(headers.get(name));
}

/**
 * Split the combined `RateLimit: limit=500000, remaining=499958, reset=42` header into its
 * `key=value` pairs. Keys are lower-cased; surrounding spaces and quotes are stripped from values.
 */
function parseCombinedRateLimit(raw: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const part of raw.split(/[,;]/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    if (key) pairs.set(key, value);
  }
  return pairs;
}

/**
 * Matches one `<uri>; rel="name"` entry of a `Link` header.
 *
 * Splitting the header on commas would be wrong: our own query strings contain commas from
 * comma-joined list params (`condition=Near Mint,LP`). Anchoring the URI to `<...>` sidesteps that.
 */
const LINK_ENTRY = /<([^>]*)>\s*;\s*rel\s*=\s*"?([^",;\s]+)"?/g;

/**
 * Extract the `cursor` query parameter from one `Link` URI.
 *
 * The server sends relative references (`</v2/cards?cursor=…>`), so a base is required to parse
 * them; it is only ever used to read the query string back off.
 */
function cursorFromUri(uri: string): string | undefined {
  try {
    return new URL(uri, 'https://api.justtcg.com').searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse the rate-limit response headers into usage metadata.
 *
 * Two header styles are accepted. The OpenAPI spec documents one combined
 * `RateLimit: limit=…, remaining=…, reset=…` header; the live API currently sends the separate
 * `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` headers. The combined header wins
 * field by field, with the separate headers as the fallback. `RateLimit-Policy` is passed through.
 *
 * Every field is optional — a cached or errored response may omit the headers entirely.
 */
export function parseV2Usage(headers: Headers): V2UsageMeta {
  const usage: V2UsageMeta = {};
  const combinedRaw = headers.get('RateLimit');
  const combined = combinedRaw === null ? undefined : parseCombinedRateLimit(combinedRaw);

  const limit = intValue(combined?.get('limit')) ?? intHeader(headers, 'RateLimit-Limit');
  if (limit !== undefined) usage.limit = limit;

  const remaining =
    intValue(combined?.get('remaining')) ?? intHeader(headers, 'RateLimit-Remaining');
  if (remaining !== undefined) usage.remaining = remaining;

  const reset = intValue(combined?.get('reset')) ?? intHeader(headers, 'RateLimit-Reset');
  if (reset !== undefined) usage.reset = reset;

  const policy = headers.get('RateLimit-Policy');
  if (policy !== null) usage.policy = policy;

  return usage;
}

/**
 * Parse the response body's `meta` (plus the `Link` header) into cursor pagination.
 *
 * Cursors come from `meta.cursor` when the body carries it, otherwise from the `Link` header, which
 * the API keeps in agreement with `meta.cursor`. `hasMore` comes from `meta.has_more`, otherwise
 * from whether a next cursor was found. A response with none of these is a single complete page,
 * which yields `hasMore: false` and no cursors rather than `undefined` — so callers can loop on
 * `hasMore` without a null check.
 *
 * @param meta The response body's `meta` object, when present. `meta.total: null` means unknown
 *   and maps to `undefined`; `total` falls back to the `X-Total-Count` header, which some
 *   responses carry without a body total.
 */
export function parseV2Pagination(headers: Headers, meta?: V2PaginationMeta): V2Pagination {
  const pagination: V2Pagination = { hasMore: false };

  const count = meta?.count;
  if (count !== undefined) pagination.count = count;

  const total = meta?.total ?? intHeader(headers, 'X-Total-Count');
  if (total !== undefined) pagination.total = total;

  const limit = meta?.limit;
  if (limit !== undefined) pagination.limit = limit;

  if (meta?.cursor) {
    if (typeof meta.cursor.next === 'string') pagination.nextCursor = meta.cursor.next;
    if (typeof meta.cursor.prev === 'string') pagination.prevCursor = meta.cursor.prev;
  } else {
    readLinkCursors(headers, pagination);
  }

  pagination.hasMore =
    typeof meta?.has_more === 'boolean' ? meta.has_more : pagination.nextCursor !== undefined;
  return pagination;
}

/** Fill `nextCursor` / `prevCursor` from the `Link` header, if there is one. */
function readLinkCursors(headers: Headers, pagination: V2Pagination): void {
  const header = headers.get('Link');
  if (!header) return;

  // `exec` in a loop rather than `matchAll`, which needs a newer lib target than this package sets.
  LINK_ENTRY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_ENTRY.exec(header)) !== null) {
    const cursor = cursorFromUri(match[1]);
    if (cursor === undefined) continue;
    if (match[2] === 'next') pagination.nextCursor = cursor;
    else if (match[2] === 'prev') pagination.prevCursor = cursor;
  }
}

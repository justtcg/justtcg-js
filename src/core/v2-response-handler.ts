import { V2Pagination, V2UsageMeta } from '../types/v2';

/**
 * v2 moved the metadata that v1 carried in the response body into response headers: usage into the
 * IETF `RateLimit-*` headers, and pagination into an RFC 8288 `Link` header. These helpers turn
 * both back into the structured shapes the SDK returns.
 */

/** Parse a header as an integer, ignoring absent or malformed values. */
function intHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
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
 * Parse the `RateLimit-*` response headers into usage metadata.
 *
 * Every field is optional — a cached or errored response may omit the headers entirely.
 */
export function parseV2Usage(headers: Headers): V2UsageMeta {
  const usage: V2UsageMeta = {};

  const limit = intHeader(headers, 'RateLimit-Limit');
  if (limit !== undefined) usage.limit = limit;

  const remaining = intHeader(headers, 'RateLimit-Remaining');
  if (remaining !== undefined) usage.remaining = remaining;

  const reset = intHeader(headers, 'RateLimit-Reset');
  if (reset !== undefined) usage.reset = reset;

  const policy = headers.get('RateLimit-Policy');
  if (policy !== null) usage.policy = policy;

  return usage;
}

/**
 * Parse the `Link` header into cursor pagination.
 *
 * A response with no `Link` header is a single complete page, which yields `hasMore: false` and no
 * cursors rather than `undefined` — so callers can loop on `hasMore` without a null check.
 */
export function parseV2Pagination(headers: Headers): V2Pagination {
  const pagination: V2Pagination = { hasMore: false };
  const header = headers.get('Link');
  if (!header) return pagination;

  // `exec` in a loop rather than `matchAll`, which needs a newer lib target than this package sets.
  LINK_ENTRY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_ENTRY.exec(header)) !== null) {
    const cursor = cursorFromUri(match[1]);
    if (cursor === undefined) continue;
    if (match[2] === 'next') pagination.nextCursor = cursor;
    else if (match[2] === 'prev') pagination.prevCursor = cursor;
  }

  pagination.hasMore = pagination.nextCursor !== undefined;
  return pagination;
}

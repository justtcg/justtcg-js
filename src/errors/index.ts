/**
 * The `application/problem+json` body (RFC 9457) returned by the v2 API.
 * v1 returns `{ error, code }` instead; both are normalized into a `JustTCGError`.
 */
export interface ProblemDetails {
  /** A URI identifying the problem type, e.g. `https://api.justtcg.com/problems/invalid-parameter`. */
  type: string;
  /** A short, human-readable summary of the problem type. */
  title: string;
  /** The HTTP status code. */
  status: number;
  /** A human-readable explanation specific to this occurrence of the problem. */
  detail: string;
  /** Problem-specific extension members (e.g. `parameter`, `available`). */
  [key: string]: unknown;
}

export interface JustTCGErrorOptions {
  /** The HTTP status code of the response that produced this error. */
  status?: number;
  /** The v1 error code, or the problem type slug for v2 errors. */
  code?: string;
  /** The raw `problem+json` body, when the API returned one. */
  problem?: ProblemDetails;
}

/**
 * The base class for every error thrown by the SDK. Extends `Error`, so existing
 * `catch (e) { e.message }` handling keeps working.
 */
export class JustTCGError extends Error {
  /** The HTTP status code of the response that produced this error. */
  public readonly status?: number;
  /** The v1 error code, or the problem type slug (e.g. `invalid-parameter`) for v2 errors. */
  public readonly code?: string;
  /** The raw `problem+json` body, when the API returned one. Nothing from the wire is lost. */
  public readonly problem?: ProblemDetails;

  constructor(message: string, options: JustTCGErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.problem = options.problem;
    // Restore the prototype chain so `instanceof` works when targeting ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The API key is missing, invalid, or not permitted to make this request (401 / 403). */
export class AuthenticationError extends JustTCGError {}

/** A request parameter was missing or invalid (400). */
export class ValidationError extends JustTCGError {
  /** The offending parameter name, when the API identifies one. */
  public readonly parameter?: string;

  constructor(message: string, options: JustTCGErrorOptions & { parameter?: string } = {}) {
    super(message, options);
    this.parameter = options.parameter;
  }
}

/**
 * A requested region is part of the v2 region vocabulary but does not serve data yet (400).
 * `available` lists the regions that are currently live.
 */
export class RegionNotAvailableError extends ValidationError {
  /** The region codes that currently return data. */
  public readonly available: string[];

  constructor(message: string, options: JustTCGErrorOptions & { available?: string[] } = {}) {
    super(message, options);
    this.available = options.available ?? [];
  }
}

/** The requested card or variant does not exist (404). */
export class NotFoundError extends JustTCGError {}

/** The request was rejected because a rate limit or plan quota was exhausted (429). */
export class RateLimitError extends JustTCGError {
  /** Seconds to wait before retrying, from `Retry-After` or `RateLimit-Reset`. */
  public readonly retryAfter?: number;

  constructor(message: string, options: JustTCGErrorOptions & { retryAfter?: number } = {}) {
    super(message, options);
    this.retryAfter = options.retryAfter;
  }
}

/** Any other API failure, including 5xx responses. */
export class ApiError extends JustTCGError {}

/** Narrow an unknown parsed body to a `problem+json` document. */
function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.type === 'string' && typeof b.title === 'string' && typeof b.status === 'number';
}

/** Extract the trailing slug from a problem type URI (`.../problems/not-found` → `not-found`). */
function problemSlug(type: string): string {
  const trimmed = type.replace(/\/+$/, '');
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

function parseRetryAfter(headers?: Headers): number | undefined {
  if (!headers) return undefined;
  const raw = headers.get('retry-after') ?? headers.get('ratelimit-reset');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Build the appropriate `JustTCGError` subclass from a failed response.
 *
 * Handles both wire formats: v2's `problem+json` (mapped by problem type, then status) and v1's
 * `{ error, code }`. The message matches v1's historical `errorBody.error || 'An API error
 * occurred'` so existing v1 error handling is unaffected.
 */
export function createApiError(status: number, body: unknown, headers?: Headers): JustTCGError {
  if (isProblemDetails(body)) {
    const slug = problemSlug(body.type);
    const message = body.detail || body.title;
    const options = { status, code: slug, problem: body };

    switch (slug) {
      case 'region-not-available':
        return new RegionNotAvailableError(message, {
          ...options,
          available: Array.isArray(body.available) ? (body.available as string[]) : undefined,
        });
      case 'missing-parameter':
      case 'invalid-parameter':
        return new ValidationError(message, {
          ...options,
          parameter: typeof body.parameter === 'string' ? body.parameter : undefined,
        });
      case 'not-found':
        return new NotFoundError(message, options);
      default:
        return byStatus(status, message, options, headers);
    }
  }

  // v1 shape: `{ error, code }`. Fall back to the historical generic message.
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const message = typeof b.error === 'string' ? b.error : 'An API error occurred';
  const code = typeof b.code === 'string' ? b.code : undefined;
  return byStatus(status, message, { status, code }, headers);
}

function byStatus(
  status: number,
  message: string,
  options: JustTCGErrorOptions,
  headers?: Headers,
): JustTCGError {
  if (status === 401 || status === 403) return new AuthenticationError(message, options);
  if (status === 404) return new NotFoundError(message, options);
  if (status === 429) {
    return new RateLimitError(message, { ...options, retryAfter: parseRetryAfter(headers) });
  }
  if (status >= 400 && status < 500) return new ValidationError(message, options);
  return new ApiError(message, options);
}

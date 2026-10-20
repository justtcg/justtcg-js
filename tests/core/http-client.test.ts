import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/core/http-client';
import {
  ApiError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  RegionNotAvailableError,
  SubscriptionRequiredError,
  ValidationError,
} from '../../src/errors';

const PROBLEM = { status: 400, headers: { 'Content-Type': 'application/problem+json' } };

const BASE_URL = 'https://api.justtcg.com';

/** Build a `fetch` mock returning a single response. */
function mockFetch(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const status = init.status ?? 200;
  const headers = new Headers({ 'Content-Type': 'application/json', ...init.headers });
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: () => Promise.resolve(body === undefined ? '' : text),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The URL the mocked `fetch` was called with. */
function calledUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string);
}

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({ apiKey: 'test-key', baseUrl: BASE_URL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('get', () => {
    it('returns the parsed body and sends the API key header', async () => {
      const fetchMock = mockFetch({ data: [{ id: 'card-1' }] });

      const result = await client.get<{ data: { id: string }[] }>('/v1/cards');

      expect(result.data[0].id).toBe('card-1');
      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('GET');
      expect(init.headers['x-api-key']).toBe('test-key');
    });

    it('serializes params, joining arrays with commas and skipping null/undefined', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.get('/v2/cards', {
        regions: ['NA', 'US'],
        limit: 20,
        include_price_history: false,
        q: null,
        set: undefined,
      });

      const url = calledUrl(fetchMock);
      expect(url.pathname).toBe('/v2/cards');
      expect(url.searchParams.get('regions')).toBe('NA,US');
      expect(url.searchParams.get('limit')).toBe('20');
      expect(url.searchParams.get('include_price_history')).toBe('false');
      expect(url.searchParams.has('q')).toBe(false);
      expect(url.searchParams.has('set')).toBe(false);
    });
  });

  describe('getRaw', () => {
    it('preserves headers and status alongside the body', async () => {
      mockFetch(
        { data: [] },
        { headers: { 'RateLimit-Remaining': '996', Link: '</v2/cards?cursor=abc>; rel="next"' } },
      );

      const response = await client.getRaw<{ data: unknown[] }>('/v2/cards');

      expect(response.status).toBe(200);
      expect(response.headers.get('RateLimit-Remaining')).toBe('996');
      expect(response.headers.get('Link')).toBe('</v2/cards?cursor=abc>; rel="next"');
      expect(response.body.data).toEqual([]);
    });
  });

  describe('post', () => {
    it('serializes the v1 batch body, joining array fields', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.post('/v1/cards', [
        { cardId: 'card-abc', printing: ['Foil', 'Normal'], include_price_history: true },
      ]);

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual([
        { cardId: 'card-abc', printing: 'Foil,Normal', include_price_history: 'true' },
      ]);
    });
  });

  describe('postRaw', () => {
    it('sends the body verbatim and supports query parameters', async () => {
      const fetchMock = mockFetch({ data: [] });

      await client.postRaw('/v2/cards', [{ card_id: 'card-abc', somethingNew: 1 }], {
        regions: ['NA'],
      });

      const [, init] = fetchMock.mock.calls[0];
      // Unknown keys survive — unlike `post`, there is no field allowlist.
      expect(JSON.parse(init.body)).toEqual([{ card_id: 'card-abc', somethingNew: 1 }]);
      expect(calledUrl(fetchMock).searchParams.get('regions')).toBe('NA');
    });
  });

  describe('error handling', () => {
    it('maps a v1 { error, code } body to a typed error, preserving the message', async () => {
      mockFetch({ error: 'Invalid API key', code: 'INVALID_API_KEY' }, { status: 401 });

      await expect(client.get('/v1/cards')).rejects.toThrow(AuthenticationError);
      await expect(client.get('/v1/cards')).rejects.toThrow('Invalid API key');
    });

    it('falls back to the historical generic message when the body has no error field', async () => {
      mockFetch({}, { status: 500 });

      await expect(client.get('/v1/cards')).rejects.toThrow('An API error occurred');
    });

    it('does not throw a JSON parse error on a non-JSON error body', async () => {
      mockFetch('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      });

      await expect(client.get('/v1/cards')).rejects.toThrow(ApiError);
    });

    it('maps a documented problem+json invalid-request to a ValidationError with the parameter', async () => {
      mockFetch(
        {
          type: 'https://justtcg.com/docs/errors#invalid-request',
          title: 'Invalid request',
          status: 400,
          detail: 'grade requires grading_company.',
          code: 'INVALID_REQUEST',
          parameter: 'grading_company',
        },
        PROBLEM,
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.parameter).toBe('grading_company');
      // `code` is the v1-compatible code, not the URI slug.
      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.status).toBe(400);
      expect(error.message).toBe('grade requires grading_company.');
      expect(error.problem.title).toBe('Invalid request');
      expect(error.problem.type).toBe('https://justtcg.com/docs/errors#invalid-request');
    });

    it('maps a documented region-not-available fragment, exposing the live regions', async () => {
      mockFetch(
        {
          type: 'https://justtcg.com/docs/errors#region-not-available',
          title: 'Region not yet available',
          status: 400,
          detail: "Region 'EU' is not yet available; currently live: NA, US.",
          code: 'INVALID_REQUEST',
          available: ['NA', 'US'],
        },
        PROBLEM,
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(RegionNotAvailableError);
      // RegionNotAvailableError is a ValidationError, so a generic 400 handler still catches it.
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.available).toEqual(['NA', 'US']);
      expect(error.code).toBe('INVALID_REQUEST');
    });

    it('maps a documented not-found fragment to a NotFoundError', async () => {
      mockFetch(
        {
          type: 'https://justtcg.com/docs/errors#not-found',
          title: 'Resource not found',
          status: 404,
          detail: 'Card with the specified identifier could not be found.',
        },
        { ...PROBLEM, status: 404 },
      );

      await expect(client.get('/v2/cards/nope')).rejects.toThrow(NotFoundError);
    });

    it('keeps the parameter on an unrecognised 400 problem type', async () => {
      mockFetch(
        {
          type: 'https://justtcg.com/docs/errors#something-new',
          title: 'Something new',
          status: 400,
          detail: 'Must be a GTIN with a valid check digit.',
          parameter: 'gtin',
        },
        PROBLEM,
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.parameter).toBe('gtin');
      // No `code` member: fall back to the slug.
      expect(error.code).toBe('something-new');
    });

    it('maps a problem+json auth error by status, keeping the code', async () => {
      mockFetch(
        {
          type: 'https://justtcg.com/docs/errors#invalid-api-key',
          title: 'Invalid API key',
          status: 401,
          detail: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
        { ...PROBLEM, status: 401 },
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).not.toBeInstanceOf(SubscriptionRequiredError);
      expect(error.code).toBe('INVALID_API_KEY');
    });

    describe('legacy /problems/<slug> type URIs (what the server sends today)', () => {
      it('maps invalid-parameter to a ValidationError, with the slug as code', async () => {
        mockFetch(
          {
            type: 'https://api.justtcg.com/problems/invalid-parameter',
            title: 'Invalid parameter',
            status: 400,
            detail: 'Must be between 1 and 200 for your plan.',
            parameter: 'limit',
          },
          PROBLEM,
        );

        const error = await client.get('/v2/cards').catch((e) => e);

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.parameter).toBe('limit');
        expect(error.code).toBe('invalid-parameter');
      });

      it('maps region-not-available to a RegionNotAvailableError', async () => {
        mockFetch(
          {
            type: 'https://api.justtcg.com/problems/region-not-available',
            title: 'Region not yet available',
            status: 400,
            detail: "Region 'EU' is not yet available; currently live: NA, US.",
            available: ['NA', 'US'],
          },
          PROBLEM,
        );

        const error = await client.get('/v2/cards').catch((e) => e);

        expect(error).toBeInstanceOf(RegionNotAvailableError);
        expect(error.available).toEqual(['NA', 'US']);
      });

      it('maps not-found to a NotFoundError', async () => {
        mockFetch(
          {
            type: 'https://api.justtcg.com/problems/not-found',
            title: 'Resource not found',
            status: 404,
            detail: 'No card matches the specified GTIN.',
          },
          { ...PROBLEM, status: 404 },
        );

        await expect(client.get('/v2/cards')).rejects.toThrow(NotFoundError);
      });
    });

    describe('SUBSCRIPTION_REQUIRED', () => {
      const reactivate = 'https://justtcg.com/dashboard/billing/reactivate?plan=pro';

      it('maps the v1 { error, code, details } shape, exposing reactivateUrl', async () => {
        mockFetch(
          {
            error: 'Your plan is not active.',
            code: 'SUBSCRIPTION_REQUIRED',
            details: { reactivate_url: reactivate },
          },
          { status: 403 },
        );

        const error = await client.get('/v1/cards').catch((e) => e);

        expect(error).toBeInstanceOf(SubscriptionRequiredError);
        // A generic auth handler still catches it.
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.reactivateUrl).toBe(reactivate);
        expect(error.code).toBe('SUBSCRIPTION_REQUIRED');
        expect(error.status).toBe(403);
        expect(error.message).toBe('Your plan is not active.');
      });

      it('maps the v2 problem shape, reading details.reactivate_url', async () => {
        mockFetch(
          {
            type: 'https://justtcg.com/docs/errors#subscription-required',
            title: 'Subscription required',
            status: 403,
            detail: 'Your plan is not active.',
            code: 'SUBSCRIPTION_REQUIRED',
            details: { reactivate_url: reactivate },
          },
          { ...PROBLEM, status: 403 },
        );

        const error = await client.get('/v2/cards').catch((e) => e);

        expect(error).toBeInstanceOf(SubscriptionRequiredError);
        expect(error.reactivateUrl).toBe(reactivate);
        expect(error.code).toBe('SUBSCRIPTION_REQUIRED');
        expect(error.problem.details).toEqual({ reactivate_url: reactivate });
      });

      it('reads a top-level reactivate_url extension member', async () => {
        mockFetch(
          {
            type: 'https://justtcg.com/docs/errors#subscription-required',
            title: 'Subscription required',
            status: 403,
            detail: 'Your plan is not active.',
            reactivate_url: reactivate,
          },
          { ...PROBLEM, status: 403 },
        );

        const error = await client.get('/v2/cards').catch((e) => e);

        expect(error).toBeInstanceOf(SubscriptionRequiredError);
        expect(error.reactivateUrl).toBe(reactivate);
      });

      it('leaves reactivateUrl undefined when the body omits it', async () => {
        mockFetch({ error: 'Your plan is not active.', code: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });

        const error = await client.get('/v1/cards').catch((e) => e);

        expect(error).toBeInstanceOf(SubscriptionRequiredError);
        expect(error.reactivateUrl).toBeUndefined();
      });
    });

    it('maps a 429 to a RateLimitError, reading retryAfter from the headers', async () => {
      mockFetch({ error: 'Rate limit exceeded' }, {
        status: 429,
        headers: { 'RateLimit-Reset': '3600' },
      });

      const error = await client.get('/v1/cards').catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryAfter).toBe(3600);
    });
  });
});

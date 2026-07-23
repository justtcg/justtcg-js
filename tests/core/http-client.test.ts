import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/core/http-client';
import {
  ApiError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  RegionNotAvailableError,
  ValidationError,
} from '../../src/errors';

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

      await client.postRaw('/v2/cards', [{ cardId: 'card-abc', somethingNew: 1 }], {
        regions: ['NA'],
      });

      const [, init] = fetchMock.mock.calls[0];
      // Unknown keys survive — unlike `post`, there is no field allowlist.
      expect(JSON.parse(init.body)).toEqual([{ cardId: 'card-abc', somethingNew: 1 }]);
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

    it('maps problem+json invalid-parameter to a ValidationError with the parameter', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/invalid-parameter',
          title: 'Invalid parameter',
          status: 400,
          detail: "grade requires grading_company.",
          parameter: 'grading_company',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.parameter).toBe('grading_company');
      expect(error.code).toBe('invalid-parameter');
      expect(error.status).toBe(400);
      expect(error.message).toBe('grade requires grading_company.');
      expect(error.problem.title).toBe('Invalid parameter');
    });

    it('maps problem+json region-not-available, exposing the live regions', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/region-not-available',
          title: 'Region not yet available',
          status: 400,
          detail: "Region 'EU' is not yet available; currently live: NA, US.",
          available: ['NA', 'US'],
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );

      const error = await client.get('/v2/cards').catch((e) => e);

      expect(error).toBeInstanceOf(RegionNotAvailableError);
      // RegionNotAvailableError is a ValidationError, so a generic 400 handler still catches it.
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.available).toEqual(['NA', 'US']);
    });

    it('maps problem+json not-found to a NotFoundError', async () => {
      mockFetch(
        {
          type: 'https://api.justtcg.com/problems/not-found',
          title: 'Resource not found',
          status: 404,
          detail: 'Card with the specified identifier could not be found.',
        },
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      );

      await expect(client.get('/v2/cards/nope')).rejects.toThrow(NotFoundError);
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

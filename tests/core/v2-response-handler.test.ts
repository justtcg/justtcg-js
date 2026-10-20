import { describe, it, expect } from 'vitest';
import { parseV2Pagination, parseV2Usage } from '../../src/core/v2-response-handler';

describe('parseV2Usage', () => {
  it('parses the separate RateLimit-* headers the live API sends', () => {
    const usage = parseV2Usage(
      new Headers({
        'RateLimit-Limit': '10000',
        'RateLimit-Remaining': '9987',
        'RateLimit-Reset': '43200',
        'RateLimit-Policy': '"daily";q=1000;w=86400',
      }),
    );

    expect(usage).toEqual({
      limit: 10000,
      remaining: 9987,
      reset: 43200,
      policy: '"daily";q=1000;w=86400',
    });
  });

  it('omits absent and malformed values rather than reporting NaN', () => {
    const usage = parseV2Usage(new Headers({ 'RateLimit-Remaining': 'unknown' }));

    expect(usage).toEqual({});
    expect('remaining' in usage).toBe(false);
  });

  it('reports a genuine zero remaining, which is distinct from absent', () => {
    expect(parseV2Usage(new Headers({ 'RateLimit-Remaining': '0' })).remaining).toBe(0);
  });

  describe('combined RateLimit header', () => {
    it('parses the documented limit/remaining/reset pairs', () => {
      const usage = parseV2Usage(
        new Headers({ RateLimit: 'limit=500000, remaining=499958, reset=42' }),
      );

      expect(usage).toEqual({ limit: 500000, remaining: 499958, reset: 42 });
    });

    it('tolerates spacing, quoting, key case and order', () => {
      const usage = parseV2Usage(
        new Headers({ RateLimit: ' Reset = "42" ,remaining="0",  LIMIT=500000 ' }),
      );

      expect(usage).toEqual({ limit: 500000, remaining: 0, reset: 42 });
    });

    it('ignores unknown keys and malformed values', () => {
      const usage = parseV2Usage(
        new Headers({ RateLimit: 'limit=abc, remaining=, policy=daily, reset=7, junk' }),
      );

      expect(usage).toEqual({ reset: 7 });
    });

    it('wins over the separate headers, which fill any field it lacks', () => {
      const usage = parseV2Usage(
        new Headers({
          RateLimit: 'remaining=10',
          'RateLimit-Limit': '500000',
          'RateLimit-Remaining': '999',
          'RateLimit-Reset': '60',
          'RateLimit-Policy': '"daily";q=50000;w=86400',
        }),
      );

      expect(usage).toEqual({
        limit: 500000,
        remaining: 10,
        reset: 60,
        policy: '"daily";q=50000;w=86400',
      });
    });
  });
});

describe('parseV2Pagination', () => {
  it('parses next and prev cursors from a Link header', () => {
    const pagination = parseV2Pagination(
      new Headers({
        Link:
          '</v2/cards?q=charizard&cursor=eyJvIjo0MH0%3D&limit=20>; rel="next", ' +
          '</v2/cards?q=charizard&cursor=eyJvIjowfQ%3D%3D&limit=20>; rel="prev"',
      }),
    );

    expect(pagination).toEqual({
      nextCursor: 'eyJvIjo0MH0=',
      prevCursor: 'eyJvIjowfQ==',
      hasMore: true,
    });
  });

  it('does not split on the commas inside comma-joined query params', () => {
    // `condition=Near Mint,Lightly Played` puts commas inside the URI, so a naive
    // `header.split(',')` would tear each link into fragments and find no cursor at all.
    const pagination = parseV2Pagination(
      new Headers({
        Link:
          '</v2/cards?condition=Near Mint,Lightly Played&regions=US,NA&cursor=next123>; rel="next", ' +
          '</v2/cards?condition=Near Mint,Lightly Played&regions=US,NA&cursor=prev123>; rel="prev"',
      }),
    );

    expect(pagination.nextCursor).toBe('next123');
    expect(pagination.prevCursor).toBe('prev123');
  });

  it('reports the last page when only a prev link is present', () => {
    const pagination = parseV2Pagination(
      new Headers({ Link: '</v2/cards?cursor=eyJvIjowfQ==>; rel="prev"' }),
    );

    expect(pagination.hasMore).toBe(false);
    expect(pagination.nextCursor).toBeUndefined();
    expect(pagination.prevCursor).toBe('eyJvIjowfQ==');
  });

  it('treats a missing Link header as a single complete page', () => {
    expect(parseV2Pagination(new Headers())).toEqual({ hasMore: false });
  });

  it('ignores link entries that carry no cursor', () => {
    const pagination = parseV2Pagination(
      new Headers({ Link: '</v2/cards>; rel="next", </docs>; rel="describedby"' }),
    );

    expect(pagination).toEqual({ hasMore: false });
  });

  it('reads total and count from the response body meta', () => {
    const pagination = parseV2Pagination(new Headers(), { count: 5, total: 31474 });

    expect(pagination).toEqual({ hasMore: false, count: 5, total: 31474 });
  });

  it('falls back to the X-Total-Count header when meta is absent', () => {
    const pagination = parseV2Pagination(new Headers({ 'X-Total-Count': '31474' }));

    expect(pagination.total).toBe(31474);
  });

  it('reads cursors, has_more and limit from meta when the body carries them', () => {
    const pagination = parseV2Pagination(new Headers(), {
      count: 20,
      total: 31563,
      limit: 20,
      has_more: true,
      cursor: { next: 'eyJvIjo0MH0=', prev: 'eyJvIjowfQ==' },
    });

    expect(pagination).toEqual({
      nextCursor: 'eyJvIjo0MH0=',
      prevCursor: 'eyJvIjowfQ==',
      hasMore: true,
      count: 20,
      total: 31563,
      limit: 20,
    });
  });

  it('prefers meta.cursor over the Link header when both are present', () => {
    const pagination = parseV2Pagination(
      new Headers({ Link: '</v2/cards?cursor=from-link>; rel="next"' }),
      { has_more: true, cursor: { next: 'from-meta', prev: null } },
    );

    expect(pagination.nextCursor).toBe('from-meta');
    expect(pagination.prevCursor).toBeUndefined();
  });

  it('treats null meta cursors as the first/last page', () => {
    const pagination = parseV2Pagination(new Headers(), {
      has_more: false,
      cursor: { next: null, prev: null },
    });

    expect(pagination).toEqual({ hasMore: false });
  });

  it('falls back to the Link header when meta has no cursor object', () => {
    const pagination = parseV2Pagination(
      new Headers({ Link: '</v2/cards?cursor=from-link>; rel="next"' }),
      { count: 1, total: 2 },
    );

    expect(pagination).toEqual({ nextCursor: 'from-link', hasMore: true, count: 1, total: 2 });
  });

  it('takes hasMore from meta.has_more even without a cursor', () => {
    expect(parseV2Pagination(new Headers(), { has_more: true }).hasMore).toBe(true);
  });

  it('maps meta.total: null (unknown) to undefined rather than zero', () => {
    const pagination = parseV2Pagination(new Headers(), { count: 3, total: null });

    expect(pagination).toEqual({ hasMore: false, count: 3 });
    expect('total' in pagination).toBe(false);
  });

  it('prefers meta.total over the X-Total-Count header when both are present', () => {
    const pagination = parseV2Pagination(new Headers({ 'X-Total-Count': '999' }), { total: 42 });

    expect(pagination.total).toBe(42);
  });
});

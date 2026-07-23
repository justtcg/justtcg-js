import { describe, it, expect } from 'vitest';
import { parseV2Pagination, parseV2Usage } from '../../src/core/v2-response-handler';

describe('parseV2Usage', () => {
  it('parses the RateLimit-* headers', () => {
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
});

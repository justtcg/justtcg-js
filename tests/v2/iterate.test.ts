import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JustTCG } from '../../src/index';
import type { V2Card } from '../../src/types/v2';

/**
 * Cursor iteration, driven by a `fetch` stub that returns a scripted sequence of pages. Each page
 * carries the `Link` header and body `meta.cursor` the real API sends (or just one of them), so the
 * generator is walking real cursors rather than a mocked pagination object.
 */

function card(name: string): V2Card {
  return {
    id: `uuid-${name}`,
    slug: name,
    name,
    game: { id: 'pokemon', name: 'Pokemon' },
    set: { id: 'base-set-pokemon', name: 'Base Set' },
    number: '1',
    rarity: null,
    external_ids: { tcgplayer: null, scryfall: null, mtgjson: null },
    details: null,
    variants: [],
  };
}

/** A page of results, plus the cursor the API would hand out for the page after it. */
interface Page {
  names: string[];
  next?: string;
}

/** Where the scripted pages carry their cursors: both places (as the live API does), or one. */
type CursorSource = 'both' | 'link' | 'meta';

/**
 * Stub `fetch` with a scripted sequence of pages, returning the recorded cursor per request.
 * A request past the end of the script fails the test rather than hanging the generator.
 */
function mockPages(pages: Page[], source: CursorSource = 'both') {
  const cursors: (string | null)[] = [];
  let call = 0;

  const fetchMock = vi.fn().mockImplementation((url: string) => {
    cursors.push(new URL(url).searchParams.get('cursor'));
    const page = pages[call++];
    if (!page) throw new Error(`Unexpected request ${call} past the end of the script`);

    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (page.next && source !== 'meta') {
      headers.set('Link', `</v2/cards?cursor=${page.next}&limit=2>; rel="next"`);
    }
    const body: Record<string, unknown> = { data: page.names.map(card) };
    if (source !== 'link') {
      body.meta = {
        count: page.names.length,
        total: null,
        limit: 2,
        has_more: page.next !== undefined,
        cursor: { next: page.next ?? null, prev: null },
      };
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      headers,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, cursors };
}

describe('v2 cards iteration', () => {
  let client: JustTCG;

  beforeEach(() => {
    client = new JustTCG({ apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks three pages, then terminates on the page with no next link', async () => {
    const { fetchMock, cursors } = mockPages([
      { names: ['a', 'b'], next: 'c2' },
      { names: ['c', 'd'], next: 'c3' },
      { names: ['e'] },
    ]);

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon', limit: 2 })) {
      names.push(c.name);
    }

    expect(names).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The first request carries no cursor; each subsequent one carries the previous page's.
    expect(cursors).toEqual([null, 'c2', 'c3']);
  });

  it.each(['link', 'meta'] as const)('walks pages using only the %s cursors', async (source) => {
    const { cursors } = mockPages(
      [{ names: ['a'], next: 'c2' }, { names: ['b'], next: 'c3' }, { names: ['c'] }],
      source,
    );

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon' })) names.push(c.name);

    expect(names).toEqual(['a', 'b', 'c']);
    expect(cursors).toEqual([null, 'c2', 'c3']);
  });

  it('never reuses a cursor', async () => {
    const { cursors } = mockPages([
      { names: ['a'], next: 'c2' },
      { names: ['b'], next: 'c3' },
      { names: ['c'], next: 'c4' },
      { names: ['d'] },
    ]);

    const seen: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon' })) seen.push(c.name);

    expect(seen).toEqual(['a', 'b', 'c', 'd']);
    const used = cursors.filter((c): c is string => c !== null);
    expect(new Set(used).size).toBe(used.length);
  });

  it.each(['both', 'link', 'meta'] as const)(
    'stops instead of looping when the server repeats a cursor (%s)',
    async (source) => {
      // A pagination bug that hands back the cursor we just used would otherwise spin forever.
      const { fetchMock } = mockPages(
        [
          { names: ['a'], next: 'stuck' },
          { names: ['b'], next: 'stuck' },
        ],
        source,
      );

      const names: string[] = [];
      for await (const c of client.v2.cards.iterate({ game: 'pokemon' })) {
        names.push(c.name);
      }

      expect(names).toEqual(['a', 'b']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('stops when the resumed cursor is handed straight back', async () => {
    const { fetchMock } = mockPages([{ names: ['a'], next: 'resume' }]);

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon', cursor: 'resume' })) {
      names.push(c.name);
    }

    expect(names).toEqual(['a']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resumes from a supplied cursor', async () => {
    const { cursors } = mockPages([{ names: ['c'], next: 'c3' }, { names: ['d'] }]);

    const seen: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon', cursor: 'c2' })) {
      seen.push(c.name);
    }

    expect(seen).toEqual(['c', 'd']);
    // The supplied cursor is used verbatim for the first request — no page-one round trip first.
    expect(cursors).toEqual(['c2', 'c3']);
  });

  it('fetches lazily, so breaking out stops the requests', async () => {
    const { fetchMock } = mockPages([
      { names: ['a', 'b'], next: 'c2' },
      { names: ['c', 'd'], next: 'c3' },
      { names: ['e'] },
    ]);

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon', limit: 2 })) {
      names.push(c.name);
      if (names.length === 3) break;
    }

    expect(names).toEqual(['a', 'b', 'c']);
    // The third page is never requested.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('yields a single page when there is no next link', async () => {
    const { fetchMock } = mockPages([{ names: ['a'] }]);

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ game: 'pokemon' })) {
      names.push(c.name);
    }

    expect(names).toEqual(['a']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('terminates on an empty first page', async () => {
    const { fetchMock } = mockPages([{ names: [] }]);

    const names: string[] = [];
    for await (const c of client.v2.cards.iterate({ q: 'nothing matches' })) {
      names.push(c.name);
    }

    expect(names).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates an error from a later page', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        call++;
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (call === 1) {
          headers.set('Link', '</v2/cards?cursor=c2>; rel="next"');
          return Promise.resolve({
            ok: true,
            status: 200,
            headers,
            text: () => Promise.resolve(JSON.stringify({ data: [card('a')] })),
          });
        }
        headers.set('Content-Type', 'application/problem+json');
        return Promise.resolve({
          ok: false,
          status: 429,
          headers,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                type: 'https://justtcg.com/docs/errors#rate-limit-exceeded',
                title: 'Too many requests',
                status: 429,
                detail: 'Rate limit exceeded.',
                code: 'RATE_LIMIT_EXCEEDED',
              }),
            ),
        });
      }),
    );

    const names: string[] = [];
    await expect(async () => {
      for await (const c of client.v2.cards.iterate({ game: 'pokemon' })) {
        names.push(c.name);
      }
    }).rejects.toThrow(/Rate limit exceeded/);

    // The first page's results were still delivered before the failure.
    expect(names).toEqual(['a']);
  });

  describe('iteratePages', () => {
    it('yields whole pages with their usage intact', async () => {
      let call = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          call++;
          const headers = new Headers({
            'Content-Type': 'application/json',
            'RateLimit-Remaining': String(100 - call),
          });
          if (call === 1) headers.set('Link', '</v2/cards?cursor=c2>; rel="next"');
          return Promise.resolve({
            ok: true,
            status: 200,
            headers,
            text: () => Promise.resolve(JSON.stringify({ data: [card(`p${call}`)] })),
          });
        }),
      );

      const pages = [];
      for await (const page of client.v2.cards.iteratePages({ game: 'pokemon' })) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0].data[0].name).toBe('p1');
      expect(pages[0].usage.remaining).toBe(99);
      expect(pages[0].pagination).toEqual({ nextCursor: 'c2', hasMore: true });
      expect(pages[1].usage.remaining).toBe(98);
      expect(pages[1].pagination).toEqual({ hasMore: false });
    });
  });
});

import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { GetCardsParams, JustTCG } from '../../src/index';
import { HttpClient } from '../../src/core/http-client';
import { BatchLookupItem, SearchCardsOptions } from '../../src/v1/resources/cards';

// Mock the entire HttpClient module
vi.mock('../../src/core/http-client');

describe('CardsResource', () => {
  let client: JustTCG;
  let mockedHttpClient: Mocked<HttpClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new JustTCG({ apiKey: 'test-key' });
    mockedHttpClient = client.v1.cards['httpClient'] as Mocked<HttpClient>;
  });

  describe('get', () => {
    it('should fetch cards with query parameters', async () => {
      // Arrange
      const params: GetCardsParams = { query: 'Charizard', limit: 10 };
      const mockRawResponse = {
        data: [{ id: 'card-1', name: 'Charizard', game: 'pokemon', set: 'Base Set', variants: [] }],
        meta: { total: 1, limit: 10, offset: 0, hasMore: false },
        _metadata: {
          apiRequestLimit: 1000,
          apiRequestsRemaining: 996,
          apiRequestsUsed: 4,
          apiPlan: 'Free Tier',
        },
      };
      mockedHttpClient.get.mockResolvedValue(mockRawResponse);

      // Act
      const result = await client.v1.cards.get(params);

      // Assert
      expect(mockedHttpClient.get).toHaveBeenCalledOnce();
      expect(mockedHttpClient.get).toHaveBeenCalledWith('/v1/cards', params);
      expect(result.data[0].name).toBe('Charizard');
      expect(result.pagination?.limit).toBe(10);
    });
  });

  describe('getByBatch', () => {
    it('should fetch cards using a batch POST request', async () => {
      // Arrange
      const items: BatchLookupItem[] = [
        { tcgplayerId: '123' },
        { cardId: 'card-abc', printing: ['Foil'] },
      ];
      const mockRawResponse = {
        data: [
          { id: 'card-123', name: 'Pikachu', game: 'pkm', set: 'base', variants: [] },
          { id: 'card-abc', name: 'Charizard', game: 'pkm', set: 'base', variants: [] },
        ],
        // Note: Batch responses might not have pagination `meta`
        _metadata: {
          apiRequestLimit: 1000,
          apiRequestsRemaining: 995,
          apiRequestsUsed: 5,
          apiPlan: 'Free Tier',
        },
      };
      mockedHttpClient.post.mockResolvedValue(mockRawResponse);

      // Act
      const result = await client.v1.cards.getByBatch(items);

      // Assert
      expect(mockedHttpClient.post).toHaveBeenCalledOnce();
      // Verify that the body sent matches the API's expected structure
      expect(mockedHttpClient.post).toHaveBeenCalledWith('/v1/cards', items);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Pikachu');
      expect(result.pagination).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should call the get method with the correct query parameter', async () => {
      // Spy on the 'get' method of the actual class instance
      const getSpy = vi.spyOn(client.v1.cards, 'get');
      // We still need to mock the underlying http client to prevent a real network call
      mockedHttpClient.get.mockResolvedValue({ data: [], _metadata: {} });

      const query = 'Pikachu';
      await client.v1.cards.search(query);

      expect(getSpy).toHaveBeenCalledOnce();
      expect(getSpy).toHaveBeenCalledWith({ query });
    });

    it('should call the get method with the query and additional options', async () => {
      const getSpy = vi.spyOn(client.v1.cards, 'get');
      mockedHttpClient.get.mockResolvedValue({ data: [], _metadata: {} });

      const query = 'Eevee';
      const options: SearchCardsOptions = { limit: 5, game: 'Pokemon' };
      await client.v1.cards.search(query, options);

      expect(getSpy).toHaveBeenCalledOnce();
      expect(getSpy).toHaveBeenCalledWith({ query, ...options });
    });
  });
});

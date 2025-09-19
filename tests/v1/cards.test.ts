import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { JustTCG } from '../../src/index';
import { HttpClient } from '../../src/core/http-client';
import { GetCardsParams } from '../../src/v1/resources/cards';

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
        data: [{ id: 'card-1', name: 'Charizard', game: 'pkm', set: 'base', variants: [] }],
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
      expect(mockedHttpClient.get).toHaveBeenCalledWith('/cards', params);
      expect(result.data[0].name).toBe('Charizard');
      expect(result.pagination?.limit).toBe(10);
    });
  });
});
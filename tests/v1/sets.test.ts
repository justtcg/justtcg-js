import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { JustTCG } from '../../src/index';
import { HttpClient } from '../../src/core/http-client';

// Mock the entire HttpClient module
vi.mock('../../src/core/http-client');

describe('SetsResource', () => {
  let client: JustTCG;
  let mockedHttpClient: Mocked<HttpClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new JustTCG({ apiKey: 'test-key' });
    // Use the corrected method for getting the mocked instance
    mockedHttpClient = client.v1.sets['httpClient'] as Mocked<HttpClient>;
  });

  it('should fetch a list of all sets when no params are given', async () => {
    // Arrange
    const mockRawResponse = {
      data: [{ id: 'set-1', name: 'The First Chapter', gameId: 'lor', releaseDate: null }],
      meta: { total: 1, limit: 25, offset: 0, hasMore: false },
      _metadata: {
        apiRequestLimit: 1000,
        apiRequestsRemaining: 998,
        apiRequestsUsed: 2,
        apiPlan: 'Free Tier',
      },
    };
    mockedHttpClient.get.mockResolvedValue(mockRawResponse);

    // Act
    const result = await client.v1.sets.list();

    // Assert
    expect(mockedHttpClient.get).toHaveBeenCalledOnce();
    expect(mockedHttpClient.get).toHaveBeenCalledWith('/sets', undefined); // Called with no params
    expect(result.data[0].name).toBe('The First Chapter');
    expect(result.pagination).toBeDefined();
    expect(result.pagination?.total).toBe(1);
  });

  it('should fetch a filtered list of sets when params are given', async () => {
    // Arrange
    const mockRawResponse = {
      data: [{ id: 'set-pkm-1', name: 'Base Set', gameId: 'pkm', releaseDate: '1999-01-09' }],
      meta: { total: 1, limit: 25, offset: 0, hasMore: false },
      _metadata: {
        apiRequestLimit: 1000,
        apiRequestsRemaining: 997,
        apiRequestsUsed: 3,
        apiPlan: 'Free Tier',
      },
    };
    mockedHttpClient.get.mockResolvedValue(mockRawResponse);
    const params = { game: 'Pokemon' };

    // Act
    const result = await client.v1.sets.list(params);

    // Assert
    expect(mockedHttpClient.get).toHaveBeenCalledOnce();
    expect(mockedHttpClient.get).toHaveBeenCalledWith('/sets', params); // Called with params
    expect(result.data[0].name).toBe('Base Set');
    expect(result.pagination).toBeDefined();
  });
});
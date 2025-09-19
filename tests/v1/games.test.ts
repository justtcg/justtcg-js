import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { JustTCG } from '../../src/index';
import { HttpClient } from '../../src/core/http-client';

// Mock the entire HttpClient module
vi.mock('../../src/core/http-client');

describe('GamesResource', () => {
  let client: JustTCG;
  let mockedHttpClient: Mocked<HttpClient>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a new client instance for each test
    client = new JustTCG({ apiKey: 'test-key' });

    // Get the mocked instance of HttpClient that the JustTCG client is using
    mockedHttpClient = client.v1.games['httpClient'] as Mocked<HttpClient>;
  });

  it('should fetch and return a list of games', async () => {
    // Arrange: Define the mock raw response from the API
    const mockRawResponse = {
      data: [
        { id: 'pokemon', name: 'Pokemon' },
        { id: 'disney-lorcana', name: 'Disney Lorcana' },
      ],
      _metadata: {
        apiRequestLimit: 1000,
        apiRequestsRemaining: 999,
        apiRequestsUsed: 1,
        apiPlan: 'Free Tier',
      },
    };

    // Mock the `get` method to return our mock response
    mockedHttpClient.get.mockResolvedValue(mockRawResponse);

    // Act: Call the method we are testing
    const result = await client.v1.games.list();

    // Assert: Verify the results
    // 1. Check that the http client was called correctly
    expect(mockedHttpClient.get).toHaveBeenCalledOnce();
    expect(mockedHttpClient.get).toHaveBeenCalledWith('/games');

    // 2. Check that the data is transformed and correct
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Pokemon');
    expect(result.usage.apiRequestsRemaining).toBe(999);

    // 3. Check that pagination is undefined for this endpoint
    expect(result.pagination).toBeUndefined();
  });
});

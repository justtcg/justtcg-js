import { JustTCG } from 'justtcg-js';

class RobustAPIClient {
  private client: JustTCG;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.client = new JustTCG();
  }

  async safeApiCall<T>(apiCall: () => Promise<T>): Promise<T | null> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await apiCall();
        return result;
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt === this.maxRetries) {
          console.error('All retry attempts failed');
          return null;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
    return null;
  }

  async getCardWithErrorHandling(cardId: string) {
    const result = await this.safeApiCall(async () => {
      const response = await this.client.v1.cards.get({ cardId });

      // Check for API-level errors
      if (response.error) {
        throw new Error(`API Error: ${response.error} (Code: ${response.code})`);
      }

      return response;
    });

    if (result) {
      console.log('Success:', result.data);
      return result;
    } else {
      console.error('Failed to retrieve card after all retries');
      return null;
    }
  }

  async getGamesWithFallback() {
    try {
      const response = await this.client.v1.games.list();
      
      if (response.error) {
        console.warn('API returned error, using fallback data');
        return this.getFallbackGames();
      }

      return response.data;
    } catch (error) {
      console.error('SDK error occurred, using fallback data:', error);
      return this.getFallbackGames();
    }
  }

  private getFallbackGames() {
    // Return cached or default data
    return [
      { id: 'pokemon', name: 'Pokemon', cardsCount: 0, setsCount: 0 },
      { id: 'mtg', name: 'Magic: The Gathering', cardsCount: 0, setsCount: 0 }
    ];
  }
}

// Usage
const apiClient = new RobustAPIClient();

// Safe card lookup
apiClient.getCardWithErrorHandling('pokemon-base-set-charizard-holo-rare');

// Safe games list with fallback
apiClient.getGamesWithFallback();
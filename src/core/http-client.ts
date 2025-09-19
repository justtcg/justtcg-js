export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
}

export interface QueryParams {
  [key: string]: string | string[] | number | boolean | undefined | null;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Performs a GET request to a given path.
   * @param path The endpoint path (e.g., '/games').
   * @param params Optional query parameters.
   * @returns The JSON response from the API.
   */
  public async get<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Safely append query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      // For now, we'll throw a generic error. We will enhance this later.
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'An API error occurred');
    }

    return response.json() as Promise<T>;
  }

  /**
   * Performs a POST request to a given path.
   * @param path The endpoint path (e.g., '/cards').
   * @param body The JSON body for the request.
   * @returns The JSON response from the API.
   */
  public async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'An API error occurred');
    }

    return response.json() as Promise<T>;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey, // Add the API key header
    };
  }
}

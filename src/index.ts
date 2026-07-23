import { HttpClient } from './core/http-client';
import { V1Client } from './v1'; // Import the new V1Client
import { V2Client } from './v2';

const API_BASE_URL = 'https://api.justtcg.com';

export interface JustTCGConfig {
  /**
   * Your JustTCG API key.
   * If not provided, the client will look for the `JUSTTCG_API_KEY` environment variable.
   */
  apiKey?: string;
  /**
   * Enable debug mode to log request details.
   */
  debug?: boolean;
}

export class JustTCG {
  /** Provides access to the v1 version of the JustTCG API. */
  public readonly v1: V1Client;
  /**
   * Provides access to the v2 version of the JustTCG API (public beta).
   *
   * Additive — reaching for `client.v2` never changes how `client.v1` behaves.
   */
  public readonly v2: V2Client;
  private readonly httpClient: HttpClient;

  /**
   * Creates an instance of the JustTCG client.
   * @param config Configuration options for the client.
   */
  constructor(config: JustTCGConfig = {}) {
    const apiKey = config.apiKey ?? process.env.JUSTTCG_API_KEY;

    if (!apiKey) {
      // We will replace this with a custom error later
      throw new Error('Authentication error: API key is missing.');
    }

    this.httpClient = new HttpClient({
      apiKey: apiKey,
      baseUrl: API_BASE_URL,
      debug: config.debug ?? false,
    });

    // Pass the httpClient instance to the version clients
    this.v1 = new V1Client(this.httpClient);
    this.v2 = new V2Client(this.httpClient);
  }
}

// Also, export our public types from the main entry point for user convenience
export * from './types';
// v2 types (public beta). Additive — every v1 type above is unchanged.
export * from './types/v2';
// v2 → v1 shape adapters, for migrating an endpoint without migrating your own types
export * from './v2/compat';
// Error classes, so users can branch on failure kinds (`catch (e) { if (e instanceof RateLimitError) … }`)
export * from './errors';

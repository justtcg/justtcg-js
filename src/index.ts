// src/index.ts

import { HttpClient } from './core/http-client';
import { V1Client } from './v1'; // Import the new V1Client

const API_BASE_URL = 'https://api.justtcg.com';

export interface JustTCGConfig {
  /**
   * Your JustTCG API key.
   * If not provided, the client will look for the `JUSTTCG_API_KEY` environment variable.
   */
  apiKey?: string;
}

export class JustTCG {
  /** Provides access to the v1 version of the JustTCG API. */
  public readonly v1: V1Client;
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
    });

    // Pass the httpClient instance to the V1Client
    this.v1 = new V1Client(this.httpClient);
  }
}

// Also, export our public types from the main entry point for user convenience
export * from './types';

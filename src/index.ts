// src/index.ts

import { HttpClient } from './core/http-client';
import { V1Client } from './v1'; // Import the new V1Client

const API_BASE_URL = 'https://api.justtcg.com';

export interface JustTCGConfig {
  apiKey?: string;
}

export class JustTCG {
  public readonly v1: V1Client;
  private readonly httpClient: HttpClient;

  constructor(config: JustTCGConfig = {}) {
    const apiKey = config.apiKey ?? process.env.JUSTTCG_API_KEY;

    if (!apiKey) {
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
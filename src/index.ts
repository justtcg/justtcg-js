// Placeholder for the v1 client namespace
class V1Client {
  // We will add properties like .cards, .sets, etc. here later
}

export interface JustTCGConfig {
  apiKey?: string;
}

export class JustTCG {
  public readonly v1: V1Client;
  private apiKey: string;

  constructor(config: JustTCGConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.JUSTTCG_API_KEY ?? '';

    if (!this.apiKey) {
      // We will replace this with a custom error later
      throw new Error('Authentication error: API key is missing.');
    }

    this.v1 = new V1Client();
  }
}
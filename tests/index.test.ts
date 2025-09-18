import { describe, it, expect, vi } from 'vitest';
import { JustTCG } from '../src/index';

// Mock process.env to control the test environment
vi.stubGlobal('process', {
  ...process,
  env: { ...process.env },
});

describe('JustTCG Client', () => {
  it('should throw an error if no API key is provided', () => {
    // Ensure the env var is not set for this test
    delete process.env.JUSTTCG_API_KEY;

    // We expect the constructor to throw an error, so we wrap it in a function
    const initializeClient = () => new JustTCG();

    expect(initializeClient).toThrow('Authentication error: API key is missing.');
  });

  it('should initialize successfully with an API key from config', () => {
    const client = new JustTCG({ apiKey: 'test-api-key' });
    expect(client).toBeInstanceOf(JustTCG);
    expect(client.v1).toBeDefined();
  });
});
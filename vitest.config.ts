import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Allows us to use test functions like `it` and `expect` without importing them
    environment: 'node', // Sets the test environment to Node.js
    include: ['tests/**/*.test.ts'], // Tells Vitest where to find our test files
  },
});
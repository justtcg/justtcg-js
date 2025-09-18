import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Our library's entry point
  format: ['cjs', 'esm'],  // We want both CommonJS and ES Module formats
  dts: true,               // Generate a single declaration file for our types
  splitting: false,
  sourcemap: true,
  clean: true,             // Clean the 'dist' directory before each build
});
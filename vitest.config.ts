import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@modelcontextprotocol/sdk': resolve(__dirname, 'node_modules/@modelcontextprotocol/sdk'),
    },
  },
});

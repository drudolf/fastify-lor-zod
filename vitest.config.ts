import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.types.ts',
        'src/index.ts',
        'src/types.ts',
        'src/__tests__/**',
      ],
      thresholds: { 100: true },
      reporter: ['text', 'json-summary'],
    },
    benchmark: {
      include: ['bench/**/*.bench.ts'],
      outputJson: 'bench/results.json',
    },
  },
});

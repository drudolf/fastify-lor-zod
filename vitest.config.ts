import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { 100: true },
    },
    benchmark: {
      include: ['bench/**/*.bench.ts'],
      outputJson: 'bench/results.json',
    },
  },
});

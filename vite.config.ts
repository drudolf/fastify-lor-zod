import { defineConfig } from 'vite';

import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'fastify',
        'zod',
        'zod/v4',
        'zod/v4/core',
        '@fastify/swagger',
        'fast-json-stringify',
      ],
    },
  },
});

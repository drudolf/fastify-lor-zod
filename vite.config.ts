import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
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
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
});

import { afterEach } from 'vitest';
import { z } from 'zod';

afterEach(() => {
  z.globalRegistry.clear();
});

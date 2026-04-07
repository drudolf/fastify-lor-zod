import { beforeEach } from 'vitest';
import { z } from 'zod';

beforeEach(() => {
  z.globalRegistry.clear();
});

/** Deep property access for test assertions. Replaces lodash-es/get. */
// biome-ignore lint/suspicious/noExplicitAny: test utility, any is appropriate
export const get = (obj: any, path: string | string[]): any => {
  const keys = Array.isArray(path) ? path : [path];
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
  }
  return result;
};

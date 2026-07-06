import { z } from 'zod';
import * as core from 'zod/v4/core';

import {
  classicSafeParse,
  fastPathSelfCheck,
  fastSafeParse,
  type SafeParseFn,
  selectParseStrategy,
} from './fast-safe-parse.js';
import assert from 'node:assert';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.number().int().optional(),
});

const invalidUser = { name: 123, email: 'not-an-email' };

const failFast = (schema: z.ZodType, data: unknown): z.ZodError => {
  const result = fastSafeParse(schema, data);
  assert(!result.success);
  return result.error;
};

const failClassic = (schema: z.ZodType, data: unknown): z.ZodError => {
  const result = schema.safeParse(data);
  assert(!result.success);
  return result.error;
};

describe('Fast safe parse', () => {
  describe('error parity with classic safeParse', () => {
    it('Fast-path error is instanceof ZodError, core $ZodError, and Error', () => {
      const error = failFast(UserSchema, invalidUser);

      expect(error instanceof z.ZodError).toBe(true);
      expect(error instanceof core.$ZodError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('Fast-path error has name ZodError and captured stack trace', () => {
      const error = failFast(UserSchema, invalidUser);

      expect(error.name).toBe('ZodError');
      assert(typeof error.stack === 'string');
      expect(error.stack.length).toBeGreaterThan(0);
    });

    it('Fast-path error message matches classic safeParse message exactly', () => {
      const fast = failFast(UserSchema, invalidUser);
      const classic = failClassic(UserSchema, invalidUser);

      expect(fast.message).toBe(classic.message);
    });

    it('Fast-path error issues deep-equal classic safeParse issues', () => {
      const fast = failFast(UserSchema, invalidUser);
      const classic = failClassic(UserSchema, invalidUser);

      expect(fast.issues).toEqual(classic.issues);
    });

    it('Fast-path error format and flatten match classic safeParse error', () => {
      const fast = failFast(UserSchema, invalidUser);
      const classic = failClassic(UserSchema, invalidUser);

      expect(fast.format()).toEqual(classic.format());
      expect(fast.flatten()).toEqual(classic.flatten());
      expect(fast.format((issue) => issue.code)).toEqual(classic.format((issue) => issue.code));
      expect(fast.flatten((issue) => issue.code)).toEqual(classic.flatten((issue) => issue.code));
    });

    it('Fast-path error isEmpty is false when issues exist', () => {
      const fast = failFast(UserSchema, invalidUser);
      const classic = failClassic(UserSchema, invalidUser);

      expect(fast.isEmpty).toBe(false);
      expect(fast.isEmpty).toBe(classic.isEmpty);
    });

    it('addIssue and addIssues update issues and lazy message reflects them', () => {
      const error = failFast(UserSchema, invalidUser);
      const [extra] = error.issues;
      assert(extra !== undefined);
      const baseCount = error.issues.length;

      error.addIssue(extra);
      expect(error.issues).toHaveLength(baseCount + 1);
      error.addIssues([extra, extra]);
      expect(error.issues).toHaveLength(baseCount + 3);
      expect(JSON.parse(error.message)).toHaveLength(baseCount + 3);
    });

    it('Assigning message overrides the lazy getter', () => {
      const error = failFast(UserSchema, invalidUser);

      error.message = 'custom message';
      expect(error.message).toBe('custom message');
      expect(error.toString()).toBe('custom message');
      error.message = 'rewritten';
      expect(error.message).toBe('rewritten');
    });

    it('JSON.stringify of fast-path error matches classic safeParse error layout', () => {
      const fast = failFast(UserSchema, invalidUser);
      const classic = failClassic(UserSchema, invalidUser);

      expect(JSON.parse(JSON.stringify(fast))).toEqual(JSON.parse(JSON.stringify(classic)));
    });
  });

  describe('success path', () => {
    it('fastSafeParse returns parsed data on success', () => {
      const result = fastSafeParse(UserSchema, { name: 'Alice', email: 'alice@example.com' });

      assert(result.success);
      expect(result.data).toEqual({ name: 'Alice', email: 'alice@example.com' });
    });

    it('fastSafeParse strips unknown keys like safeParse', () => {
      const input = { name: 'Alice', email: 'alice@example.com', role: 'admin' };
      const fast = fastSafeParse(UserSchema, input);
      const classic = UserSchema.safeParse(input);

      assert(fast.success);
      assert(classic.success);
      expect(fast.data).toEqual({ name: 'Alice', email: 'alice@example.com' });
      expect(fast.data).toEqual(classic.data);
    });

    it('fastSafeParse throws ZodAsyncError on async schema', () => {
      const asyncSchema = z.string().transform(async (value) => value);

      expect(() => fastSafeParse(asyncSchema, 'ok')).toThrow(core.$ZodAsyncError);
      expect(() => asyncSchema.safeParse('ok')).toThrow(core.$ZodAsyncError);
    });
  });

  describe('self-check and strategy selection', () => {
    it('Self-check passes on the current zod version', () => {
      expect(fastPathSelfCheck()).toBe(true);
    });

    it('Self-check fails when the fast parse is broken', () => {
      const throwing: SafeParseFn = () => {
        throw new Error('broken');
      };
      expect(fastPathSelfCheck(throwing)).toBe(false);

      const alwaysMangledSuccess: SafeParseFn = () => ({
        success: true,
        data: { probe: 'mangled' },
      });
      expect(fastPathSelfCheck(alwaysMangledSuccess)).toBe(false);

      const alwaysEchoSuccess: SafeParseFn = () => ({ success: true, data: { probe: 'ok' } });
      expect(fastPathSelfCheck(alwaysEchoSuccess)).toBe(false);

      const tamperedMessage: SafeParseFn = (schema, data) => {
        const result = fastSafeParse(schema, data);
        if (!result.success) result.error.message = 'tampered';
        return result;
      };
      expect(fastPathSelfCheck(tamperedMessage)).toBe(false);
    });

    it('Self-check fails when zod internals are missing', async () => {
      vi.resetModules();
      vi.doMock('zod/v4/core', async (importOriginal) => {
        const original = await importOriginal<typeof core>();
        return { ...original, util: { ...original.util, finalizeIssue: undefined } };
      });

      const mocked = await import('./fast-safe-parse.js');
      expect(mocked.fastPathSelfCheck()).toBe(false);

      vi.doUnmock('zod/v4/core');
      vi.resetModules();
    });

    it('selectParseStrategy falls back to classic safeParse and emits a warning', () => {
      const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

      const strategy = selectParseStrategy(false);
      expect(strategy).toBe(classicSafeParse);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back'));

      const result = strategy(UserSchema, invalidUser);
      assert(!result.success);
      expect(result.error).toBeInstanceOf(z.ZodError);

      warn.mockRestore();
    });

    it('selectParseStrategy returns the fast path without warning when healthy', () => {
      const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

      expect(selectParseStrategy(true)).toBe(fastSafeParse);
      expect(warn).not.toHaveBeenCalled();

      warn.mockRestore();
    });
  });
});

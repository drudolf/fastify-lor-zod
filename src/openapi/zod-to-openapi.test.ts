import { z } from 'zod';

import {
  getOASVersion,
  isZodInternal,
  jsonSchemaToOAS,
  zodSchemaToJson,
} from './zod-to-openapi.js';

describe('zod-to-openapi', () => {
  it('passes through schema for OAS 3.1', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      $schema: 'https://json-schema.org/draft/2020-12/schema',
    };

    const result = jsonSchemaToOAS(schema, '3.1');

    expect(result).toBe(schema); // same reference
    expect(result.$schema).toBeDefined();
  });

  it('removes OAS 3.0 incompatible keys', () => {
    const schema = {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'test',
      unevaluatedProperties: false,
      dependentSchemas: {},
      patternProperties: {},
      propertyNames: { type: 'string' },
      contentEncoding: 'base64',
      contentMediaType: 'application/octet-stream',
      properties: { name: { type: 'string' } },
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    expect(result.$schema).toBeUndefined();
    expect(result.$id).toBeUndefined();
    expect(result.unevaluatedProperties).toBeUndefined();
    expect(result.dependentSchemas).toBeUndefined();
    expect(result.patternProperties).toBeUndefined();
    expect(result.propertyNames).toBeUndefined();
    expect(result.contentEncoding).toBeUndefined();
    expect(result.contentMediaType).toBeUndefined();
    expect(result.properties).toBeDefined();
  });

  it('recursively converts properties for OAS 3.0', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', $schema: 'remove-me' },
        nested: {
          type: 'object',
          properties: {
            value: { type: 'number', $id: 'remove-me' },
          },
        },
      },
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.name.$schema).toBeUndefined();
    expect(props.name.type).toBe('string');
    const nestedProps = props.nested.properties as Record<string, Record<string, unknown>>;
    expect(nestedProps.value.$id).toBeUndefined();
    expect(nestedProps.value.type).toBe('number');
  });

  it('recursively converts items for OAS 3.0', () => {
    const schema = {
      type: 'array',
      items: { type: 'string', $schema: 'remove-me' },
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    const items = result.items as Record<string, unknown>;
    expect(items.$schema).toBeUndefined();
    expect(items.type).toBe('string');
  });

  it('recursively converts anyOf entries for OAS 3.0', () => {
    const schema = {
      anyOf: [{ type: 'string', $id: 'remove' }, { type: 'number' }],
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    const entries = result.anyOf as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0].$id).toBeUndefined();
    expect(entries[0].type).toBe('string');
  });

  it('recursively converts oneOf entries for OAS 3.0', () => {
    const schema = {
      oneOf: [{ type: 'string', $schema: 'remove' }, { type: 'number' }],
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    const entries = result.oneOf as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0].$schema).toBeUndefined();
  });

  it('recursively converts allOf entries for OAS 3.0', () => {
    const schema = {
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } }, $id: 'remove' },
        { type: 'object', properties: { b: { type: 'number' } } },
      ],
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    const entries = result.allOf as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0].$id).toBeUndefined();
  });

  it('does not mutate original schema', () => {
    const schema = {
      type: 'object',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: { name: { type: 'string' } },
    };

    jsonSchemaToOAS(schema, '3.0');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('preserves $ref schemas as-is', () => {
    const schema = {
      $ref: '#/components/schemas/User',
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    expect(result.$ref).toBe('#/components/schemas/User');
  });

  it('does not recurse into additionalProperties for OAS 3.0', () => {
    const schema = {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: {
          type: 'string',
          $id: 'should-survive',
        },
      },
    };

    const result = jsonSchemaToOAS(schema, '3.0');

    // additionalProperties is not recursed — nested $id must survive
    expect(result.type).toBe('object');
    const inner = (result.additionalProperties as Record<string, unknown>)
      .additionalProperties as Record<string, unknown>;
    expect(inner.$id).toBe('should-survive');
  });

  it('throws on unsupported OpenAPI version', () => {
    expect(() =>
      getOASVersion({
        openapiObject: { openapi: '2.0.0' } as Record<string, unknown>,
      } as Parameters<typeof getOASVersion>[0]),
    ).toThrow('Unsupported OpenAPI document object');
  });
  // --- Scaffolded from test-spec.md ---
  it('isZodInternal returns true for a valid Zod schema', () => {
    expect(isZodInternal(z.string())).toBe(true);
  });

  it('isZodInternal returns false for non-ZodType input', () => {
    expect(isZodInternal({})).toBe(false);
    expect(isZodInternal(null)).toBe(false);
    expect(isZodInternal('string')).toBe(false);
  });

  it('zodSchemaToJson throws if Zod internal API is absent', () => {
    expect(() =>
      zodSchemaToJson({} as unknown as z.ZodType, z.globalRegistry, 'output', '3.0'),
    ).toThrow('[fastify-lor-zod] Zod v4 internal API has changed');
  });
});

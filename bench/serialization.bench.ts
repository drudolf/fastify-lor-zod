import { serializerCompiler as fastifyOrgSerializer } from '@fastify/type-provider-zod';
import { serializerCompiler as turkerSerializer } from 'fastify-type-provider-zod';
import { serializerCompiler as samchungySerializer } from 'fastify-zod-openapi';
import { bench, describe } from 'vitest';

import {
  fastSerializerCompiler as lorZodFastSerializer,
  parseSerializerCompiler as lorZodParseSerializer,
  serializerCompiler as lorZodSerializer,
} from '../src/serializer/serializer.js';
import {
  benchOpts,
  OrderSchema,
  OrderSchemaWithCodec,
  PaymentResponse,
  TreeNodeSchema,
  UserResponse,
  UserResponseWithCodec,
  validOrderData,
  validOrderDataWithCodec,
  validPaymentSuccess,
  validTreeData,
  validUserResponseData,
  validUserResponseDataWithCodec,
} from './schemas.js';

let _result: unknown;

const compile = (
  serializers: Record<string, typeof lorZodSerializer>,
  schema: unknown,
  url: string,
) =>
  Object.fromEntries(
    Object.entries(serializers).map(([name, s]) => [
      name,
      s({ schema, method: 'GET', url } as Parameters<typeof lorZodSerializer>[0]),
    ]),
  );

const allProviders = {
  'fastify-lor-zod': lorZodSerializer,
  'fastify-lor-zod (parse)': lorZodParseSerializer,
  'fastify-lor-zod (fast)': lorZodFastSerializer,
  'fastify-type-provider-zod': turkerSerializer,
  '@fastify/type-provider-zod': fastifyOrgSerializer,
  'fastify-zod-openapi': samchungySerializer,
};

// Codec-capable serializers: lor-zod auto-detect and fast, plus
// @fastify/type-provider-zod (always safeEncode). The parse variant and the
// remaining competitors would fail validation on Date objects.
const codecProviders = {
  'fastify-lor-zod': lorZodSerializer,
  'fastify-lor-zod (fast)': lorZodFastSerializer,
  '@fastify/type-provider-zod': fastifyOrgSerializer,
};

// --- Without codecs (auto-detect → safeParse) ---

const userSerializers = compile(allProviders, UserResponse, '/users/42');
const orderSerializers = compile(allProviders, OrderSchema, '/orders/1');

describe('without codecs — simple object (UserResponse)', () => {
  for (const [name, serialize] of Object.entries(userSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validUserResponseData);
      },
      benchOpts,
    );
  }
});

describe('without codecs — deeply nested (Order, 10 items)', () => {
  for (const [name, serialize] of Object.entries(orderSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validOrderData);
      },
      benchOpts,
    );
  }
});

// --- With codecs (auto-detect → safeEncode) ---
// Codec groups run only the codec-capable serializers (see codecProviders above).

const userCodecSerializers = compile(codecProviders, UserResponseWithCodec, '/users/42');
const orderCodecSerializers = compile(codecProviders, OrderSchemaWithCodec, '/orders/1');

describe('with codecs — simple object (UserResponse + date codec)', () => {
  for (const [name, serialize] of Object.entries(userCodecSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validUserResponseDataWithCodec);
      },
      benchOpts,
    );
  }
});

describe('with codecs — deeply nested (Order + money codec)', () => {
  for (const [name, serialize] of Object.entries(orderCodecSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validOrderDataWithCodec);
      },
      benchOpts,
    );
  }
});

// --- Other schema shapes (without codecs) ---

const paymentSerializers = compile(allProviders, PaymentResponse, '/payments/1');
const treeSerializers = compile(allProviders, TreeNodeSchema, '/tree');

describe('without codecs — discriminated union (Payment)', () => {
  for (const [name, serialize] of Object.entries(paymentSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validPaymentSuccess);
      },
      benchOpts,
    );
  }
});

describe('without codecs — recursive tree (3 levels deep)', () => {
  for (const [name, serialize] of Object.entries(treeSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validTreeData);
      },
      benchOpts,
    );
  }
});

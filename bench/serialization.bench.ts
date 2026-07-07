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
  UserResponseWithTransform,
  validOrderData,
  validOrderDataLarge,
  validOrderDataWithCodec,
  validPaymentSuccess,
  validTreeData,
  validUserResponseData,
  validUserResponseDataWithCodec,
  validUserResponseDataWithTransform,
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

// Codec-capable serializers: lor-zod auto-detect plus the two encode-based
// competitors (fastify-type-provider-zod switched to safeEncode in v7). The
// parse variant and fastify-zod-openapi fail on Date objects. The fast
// variant is excluded: it rejects codec/transform/preprocess schemas at
// route registration (fast-json-stringify cannot execute them).
const codecProviders = {
  'fastify-lor-zod': lorZodSerializer,
  'fastify-type-provider-zod': turkerSerializer,
  '@fastify/type-provider-zod': fastifyOrgSerializer,
};

// Guard the codec inclusion: if a future release silently breaks codec
// round-trips, fail loudly instead of benching a wrong code path. Checks
// both a native-type codec (Date→ISO) and a custom encode function (money).
for (const [name, compiler] of Object.entries(codecProviders)) {
  const dateProbe = compile({ probe: compiler }, UserResponseWithCodec, '/probe').probe;
  const dateOutput = JSON.parse(dateProbe(validUserResponseDataWithCodec));
  if (dateOutput.createdAt !== '2025-01-01T00:00:00.000Z') {
    throw new Error(`[bench] ${name} failed the date-codec round-trip: ${dateOutput.createdAt}`);
  }
  const moneyProbe = compile({ probe: compiler }, OrderSchemaWithCodec, '/probe').probe;
  const moneyOutput = JSON.parse(moneyProbe(validOrderDataWithCodec));
  if (moneyOutput.totals.total !== '$355.89') {
    throw new Error(
      `[bench] ${name} failed the money-codec round-trip: ${moneyOutput.totals.total}`,
    );
  }
}

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

// --- Large payload (array-heavy response) ---

// Guard: the fixture must be valid, or every row in the large-array group
// would silently bench the error path instead of serialization.
if (!OrderSchema.safeParse(validOrderDataLarge).success) {
  throw new Error('[bench] validOrderDataLarge does not satisfy OrderSchema');
}

const largeOrderSerializers = compile(allProviders, OrderSchema, '/orders/large');

describe('without codecs — large array (Order, 1000 items)', () => {
  for (const [name, serialize] of Object.entries(largeOrderSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validOrderDataLarge);
      },
      benchOpts,
    );
  }
});

// --- One-way transform in the response schema (lor-zod only — capability) ---
// All three competitors fail this schema (probe-verified 2026-07-06):
// fastify-type-provider-zod 7 and @fastify/type-provider-zod throw
// $ZodEncodeError at request time, fastify-zod-openapi at schema compile time.
// lor-zod's parse variant is omitted because after compile-time transform
// detection the auto compiler uses the identical captured safeParse path, and
// the fast variant rejects transform schemas at route registration.

const transformSerializers = compile(
  { 'fastify-lor-zod': lorZodSerializer },
  UserResponseWithTransform,
  '/users/42/display',
);

describe('transforms — one-way transform in response (lor-zod only — capability)', () => {
  for (const [name, serialize] of Object.entries(transformSerializers)) {
    bench(
      name,
      () => {
        _result = serialize(validUserResponseDataWithTransform);
      },
      benchOpts,
    );
  }
});

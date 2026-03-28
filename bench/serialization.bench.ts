import { serializerCompiler as turkerSerializer } from 'fastify-type-provider-zod';
import { serializerCompiler as samchungySerializer } from 'fastify-zod-openapi';
import { bench, describe } from 'vitest';

import {
  fastSerializerCompiler as lorZodFastSerializer,
  parseSerializerCompiler as lorZodParseSerializer,
  serializerCompiler as lorZodSerializer,
} from '../src/serializer.js';
import {
  benchOpts,
  OrderSchema,
  PaymentResponse,
  TreeNodeSchema,
  UserResponse,
  validOrderData,
  validPaymentSuccess,
  validTreeData,
  validUserResponseData,
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

const providers = {
  'fastify-lor-zod': lorZodSerializer,
  'fastify-lor-zod (parse)': lorZodParseSerializer,
  'fastify-lor-zod (fast)': lorZodFastSerializer,
  'fastify-type-provider-zod': turkerSerializer,
  'fastify-zod-openapi': samchungySerializer,
};

// Pre-compile all serializers
const userSerializers = compile(providers, UserResponse, '/users/42');
const orderSerializers = compile(providers, OrderSchema, '/orders/1');
const paymentSerializers = compile(providers, PaymentResponse, '/payments/1');
const treeSerializers = compile(providers, TreeNodeSchema, '/tree');

describe('serialization — simple object (UserResponse)', () => {
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

describe('serialization — deeply nested (Order, 10 items)', () => {
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

describe('serialization — discriminated union (Payment)', () => {
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

describe('serialization — recursive tree (3 levels deep)', () => {
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

import { validatorCompiler as turkerValidator } from 'fastify-type-provider-zod';
import { validatorCompiler as samchungyValidator } from 'fastify-zod-openapi';
import { bench, describe } from 'vitest';

import { validatorCompiler as lorZodValidator } from '../src/validator.js';
import {
  benchOpts,
  CreateUserBody,
  OrderSchema,
  PaymentResponse,
  TreeNodeSchema,
  validCreateUserData,
  validOrderData,
  validPaymentSuccess,
  validTreeData,
} from './schemas.js';

let _result: unknown;

const compile = (
  validators: Record<string, typeof lorZodValidator>,
  schema: unknown,
  httpPart: string,
) =>
  Object.fromEntries(
    Object.entries(validators).map(([name, v]) => [
      name,
      v({ schema, httpPart } as Parameters<typeof lorZodValidator>[0]),
    ]),
  );

const providers = {
  'fastify-lor-zod': lorZodValidator,
  'fastify-type-provider-zod': turkerValidator,
  'fastify-zod-openapi': samchungyValidator,
};

// Pre-compile all validators
const userValidators = compile(providers, CreateUserBody, 'body');
const orderValidators = compile(providers, OrderSchema, 'body');
const paymentValidators = compile(providers, PaymentResponse, 'body');
const treeValidators = compile(providers, TreeNodeSchema, 'body');

describe('validation — simple object (CreateUser)', () => {
  for (const [name, validate] of Object.entries(userValidators)) {
    bench(
      name,
      () => {
        _result = validate(validCreateUserData);
      },
      benchOpts,
    );
  }
});

describe('validation — deeply nested (Order, 10 items)', () => {
  for (const [name, validate] of Object.entries(orderValidators)) {
    bench(
      name,
      () => {
        _result = validate(validOrderData);
      },
      benchOpts,
    );
  }
});

describe('validation — discriminated union (Payment)', () => {
  for (const [name, validate] of Object.entries(paymentValidators)) {
    bench(
      name,
      () => {
        _result = validate(validPaymentSuccess);
      },
      benchOpts,
    );
  }
});

describe('validation — recursive tree (3 levels deep)', () => {
  for (const [name, validate] of Object.entries(treeValidators)) {
    bench(
      name,
      () => {
        _result = validate(validTreeData);
      },
      benchOpts,
    );
  }
});

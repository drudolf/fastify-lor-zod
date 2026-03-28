import { z } from 'zod';

// --- Shared schemas (identical across all providers) ---

const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
});

export const CreateUserBody = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['admin', 'user', 'moderator']).default('user'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  address: AddressSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const PostSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  published: z.boolean(),
});

export const UserResponse = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  age: z.number().int().nullable(),
  role: z.enum(['admin', 'user', 'moderator']),
  tags: z.array(z.string()),
  address: AddressSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  posts: z.array(PostSchema),
});

export const FullRouteSchema = {
  params: z.object({ id: z.coerce.number().int() }),
  querystring: z.object({
    fields: z.string().optional(),
    include: z.array(z.enum(['posts', 'address'])).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  headers: z.object({ 'x-api-key': z.string().min(1) }).loose(),
  body: CreateUserBody,
  response: {
    200: UserResponse,
    404: z.object({ error: z.string(), message: z.string() }),
  },
};

// --- Valid data fixtures ---

export const validCreateUserData = {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 30,
  role: 'admin',
  tags: ['engineering', 'lead'],
  address: {
    street: '123 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'US',
  },
  metadata: { department: 'engineering', level: 'senior' },
};

export const validUserResponseData = {
  id: 42,
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 30,
  role: 'admin' as const,
  tags: ['engineering', 'lead'],
  address: {
    street: '123 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'US',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-06-15T12:30:00.000Z',
  posts: [
    { id: 1, title: 'Hello World', published: true },
    { id: 2, title: 'Draft Post', published: false },
    { id: 3, title: 'Advanced Zod', published: true },
  ],
};

// --- Complex schemas ---

// Discriminated union — exercises branching logic in validation
const SuccessResponse = z.object({
  status: z.literal('success'),
  transactionId: z.string(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY']),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const FailedResponse = z.object({
  status: z.literal('failed'),
  errorCode: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  failedAt: z.string().datetime(),
});

const PendingResponse = z.object({
  status: z.literal('pending'),
  estimatedMs: z.number().int().positive(),
  pollUrl: z.string().url(),
  attempts: z.number().int().min(0),
});

export const PaymentResponse = z.discriminatedUnion('status', [
  SuccessResponse,
  FailedResponse,
  PendingResponse,
]);

export const validPaymentSuccess = {
  status: 'success' as const,
  transactionId: 'tx_abc123def456',
  amount: 99.99,
  currency: 'USD' as const,
  timestamp: '2025-06-15T12:30:00.000Z',
  metadata: { source: 'web', region: 'us-west-2' },
};

// Deeply nested e-commerce order — exercises nested object + array parsing
const OrderItemSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().min(0).max(100).optional(),
  attributes: z.record(z.string(), z.string()),
  variants: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      priceModifier: z.number().optional(),
    }),
  ),
});

const OrderAddressSchema = z.object({
  name: z.string().min(1),
  street: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().length(2),
  phone: z.string().optional(),
});

export const OrderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(OrderItemSchema),
  shipping: z.object({
    address: OrderAddressSchema,
    method: z.enum(['standard', 'express', 'overnight']),
    cost: z.number().nonnegative(),
    estimatedDays: z.number().int().positive(),
    tracking: z.string().nullable(),
  }),
  billing: z.object({
    address: OrderAddressSchema,
    cardLast4: z.string().length(4),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int(),
    cardBrand: z.enum(['visa', 'mastercard', 'amex', 'discover']),
  }),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    shipping: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  notes: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const makeItem = (i: number) => ({
  productId: `prod_${i}`,
  sku: `SKU-${1000 + i}`,
  quantity: 1 + (i % 3),
  unitPrice: 19.99 + i * 5,
  discount: i % 2 === 0 ? 10 : undefined,
  attributes: { color: 'blue', size: 'M' },
  variants: [
    { name: 'color', value: 'blue', priceModifier: 0 },
    { name: 'size', value: 'M' },
  ],
});

const orderAddress = {
  name: 'Alice Johnson',
  street: '123 Main St',
  city: 'Portland',
  state: 'OR',
  zip: '97201',
  country: 'US',
  phone: '+1-503-555-0100',
};

export const validOrderData = {
  orderId: 'ord_xyz789',
  userId: 'usr_abc123',
  items: Array.from({ length: 10 }, (_, i) => makeItem(i)),
  shipping: {
    address: orderAddress,
    method: 'express' as const,
    cost: 12.99,
    estimatedDays: 3,
    tracking: 'TRK-123456789',
  },
  billing: {
    address: orderAddress,
    cardLast4: '4242',
    expiryMonth: 12,
    expiryYear: 2027,
    cardBrand: 'visa' as const,
  },
  totals: {
    subtotal: 349.9,
    tax: 28.0,
    shipping: 12.99,
    discount: 35.0,
    total: 355.89,
  },
  status: 'confirmed' as const,
  notes: ['Gift wrap please', 'Leave at door'],
  createdAt: '2025-06-15T10:00:00.000Z',
  updatedAt: '2025-06-15T10:05:00.000Z',
};

// Recursive/lazy schema — exercises deferred evaluation
type TreeNode = {
  id: number;
  label: string;
  children: TreeNode[];
};

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.number().int(),
    label: z.string(),
    children: z.array(TreeNodeSchema),
  }),
);

export const validTreeData: TreeNode = {
  id: 1,
  label: 'root',
  children: [
    {
      id: 2,
      label: 'child-a',
      children: [
        { id: 4, label: 'leaf-1', children: [] },
        { id: 5, label: 'leaf-2', children: [] },
      ],
    },
    {
      id: 3,
      label: 'child-b',
      children: [
        {
          id: 6,
          label: 'nested',
          children: [{ id: 7, label: 'deep-leaf', children: [] }],
        },
      ],
    },
  ],
};

// --- Codec variants (Date ↔ ISO string) ---

const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso: string) => new Date(iso),
  encode: (date: Date) => date.toISOString(),
});

export const UserResponseWithCodec = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  age: z.number().int().nullable(),
  role: z.enum(['admin', 'user', 'moderator']),
  tags: z.array(z.string()),
  address: AddressSchema.nullable(),
  createdAt: dateCodec,
  updatedAt: dateCodec,
  posts: z.array(PostSchema),
});

export const validUserResponseDataWithCodec = {
  ...validUserResponseData,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-15T12:30:00.000Z'),
};

// Money codec: domain stores cents as integer, wire format is "$12.99" string
const moneyCodec = z.codec(z.string(), z.number().int(), {
  decode: (s: string) => Math.round(Number.parseFloat(s.replace('$', '')) * 100),
  encode: (cents: number) => `$${(cents / 100).toFixed(2)}`,
});

export const OrderSchemaWithCodec = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(OrderItemSchema),
  shipping: z.object({
    address: OrderAddressSchema,
    method: z.enum(['standard', 'express', 'overnight']),
    cost: moneyCodec,
    estimatedDays: z.number().int().positive(),
    tracking: z.string().nullable(),
  }),
  billing: z.object({
    address: OrderAddressSchema,
    cardLast4: z.string().length(4),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int(),
    cardBrand: z.enum(['visa', 'mastercard', 'amex', 'discover']),
  }),
  totals: z.object({
    subtotal: moneyCodec,
    tax: moneyCodec,
    shipping: moneyCodec,
    discount: moneyCodec,
    total: moneyCodec,
  }),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  notes: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const validOrderDataWithCodec = {
  ...validOrderData,
  shipping: {
    ...validOrderData.shipping,
    cost: 1299, // $12.99 in cents
  },
  totals: {
    subtotal: 34990,
    tax: 2800,
    shipping: 1299,
    discount: 3500,
    total: 35589,
  },
};

// --- Bench options (consistent across all benchmarks) ---

export const benchOpts = {
  time: 1000,
  warmupTime: 200,
  iterations: 100,
} as const;

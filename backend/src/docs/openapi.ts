/**
 * OpenAPI 3.1 document, generated from the same zod schemas the routes
 * validate with (@asteasolutions/zod-to-openapi). Served as Swagger UI at
 * /api/docs and raw JSON at /api/docs.json — dev / staging only (see app.ts).
 *
 * The request schemas are imported from src/validators so the docs cannot
 * drift from validation. Response schemas are declared here (they mirror the
 * service DTOs). Cross-field rules enforced by zod .refine() — e.g. "exactly
 * one of companyName / companyId" — are lost in the OpenAPI projection, so
 * they are spelled out in endpoint descriptions.
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { env } from '../config/env.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from '../validators/auth.validators.js';
import { renameCompanySchema } from '../validators/company.validators.js';
// createExpenseSchema is not reused here: POST /expenses is multipart/form-data
// with a binary `receipt` field, modelled inline below.
import {
  setStatusSchema,
  updateExpenseSchema,
} from '../validators/expense.validators.js';
import { updateUserSchema } from '../validators/user.validators.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security scheme
// ---------------------------------------------------------------------------
const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token from POST /auth/login or /auth/register.',
});

// ---------------------------------------------------------------------------
// Reusable component schemas
// ---------------------------------------------------------------------------
const RoleEnum = z.enum(['employee', 'manager', 'admin']).openapi('Role');
const StatusEnum = z
  .enum(['pending', 'approved', 'rejected'])
  .openapi('ExpenseStatus');

const ErrorResponse = registry.register(
  'ErrorResponse',
  z
    .object({
      error: z.object({
        code: z
          .enum([
            'VALIDATION_ERROR',
            'UNAUTHENTICATED',
            'INVALID_CREDENTIALS',
            'TOKEN_EXPIRED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'UNPROCESSABLE',
            'INTERNAL',
          ])
          .openapi({ example: 'NOT_FOUND' }),
        message: z.string().openapi({ example: 'Resource not found' }),
        details: z.unknown().optional(),
      }),
    })
    .openapi('ErrorResponse'),
);

const PublicUser = registry.register(
  'PublicUser',
  z
    .object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      name: z.string().openapi({ example: 'Ada Lovelace' }),
      email: z.string().email().openapi({ example: 'ada@acme.test' }),
      role: RoleEnum,
      createdAt: z.string().datetime(),
    })
    .openapi('PublicUser'),
);

const Company = registry.register(
  'Company',
  z
    .object({
      id: z.string().uuid(),
      name: z.string().openapi({ example: 'Acme Inc' }),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      userCount: z.number().int().openapi({ example: 3 }),
    })
    .openapi('Company'),
);

const Expense = registry.register(
  'Expense',
  z
    .object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      userId: z.string().uuid(),
      amount: z.string().openapi({ example: '42.50', description: 'Decimal string, never a float.' }),
      category: z.string().openapi({ example: 'Meals' }),
      expenseDate: z.string().openapi({ example: '2026-08-20', description: 'YYYY-MM-DD' }),
      comment: z.string().nullable().openapi({ example: 'Client lunch' }),
      receiptUrl: z.string().nullable().openapi({ example: 'http://localhost:4000/uploads/171-ab.png' }),
      status: StatusEnum,
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .openapi('Expense'),
);

const AuthResult = registry.register(
  'AuthResult',
  z
    .object({
      user: PublicUser,
      accessToken: z.string().openapi({ example: 'eyJhbGciOi...' }),
      refreshToken: z.string().openapi({ example: 'eyJhbGciOi...' }),
    })
    .openapi('AuthResult'),
);

const DashboardBucket = z.object({
  count: z.number().int().openapi({ example: 3 }),
  total: z.string().openapi({ example: '143.50' }),
});
const Dashboard = registry.register(
  'AnalyticsDashboard',
  z
    .object({
      monthTotal: z.string().openapi({ example: '357.26' }),
      monthCount: z.number().int().openapi({ example: 6 }),
      pending: DashboardBucket,
      approved: DashboardBucket,
      rejected: DashboardBucket,
    })
    .openapi('AnalyticsDashboard'),
);

const MonthlyPoint = registry.register(
  'AnalyticsMonthlyPoint',
  z
    .object({
      month: z.string().openapi({ example: '2026-08' }),
      total: z.string().openapi({ example: '357.26' }),
      count: z.number().int().openapi({ example: 6 }),
    })
    .openapi('AnalyticsMonthlyPoint'),
);

const CategoryPoint = registry.register(
  'AnalyticsCategoryPoint',
  z
    .object({
      category: z.string().openapi({ example: 'Travel' }),
      total: z.string().openapi({ example: '420.00' }),
      count: z.number().int().openapi({ example: 2 }),
    })
    .openapi('AnalyticsCategoryPoint'),
);

// Envelope helpers -----------------------------------------------------------
const dataOf = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema });
const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      page: z.number().int().openapi({ example: 1 }),
      pageSize: z.number().int().openapi({ example: 20 }),
      total: z.number().int().openapi({ example: 42 }),
    }),
  });

// Common response fragments
const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const errRef = { description: 'Error', content: json(ErrorResponse) };
const unauthorized = { 401: errRef };
const forbidden = { 403: errRef };
const notFound = { 404: errRef };
const validationErr = { 400: errRef };

// ---------------------------------------------------------------------------
// Paths — Auth
// ---------------------------------------------------------------------------
registry.registerPath({
  method: 'post',
  path: '/auth/register',
  operationId: 'authRegister',
  tags: ['Auth'],
  summary: 'Register a new account',
  description:
    'Provide **exactly one** of `companyName` (create a new company — you become its **admin**) ' +
    'or `companyId` (join an existing company as an **employee**).',
  security: [], // public
  request: { body: { content: json(registerSchema), required: true } },
  responses: {
    201: { description: 'Account created', content: json(AuthResult) },
    ...validationErr,
    409: errRef,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  operationId: 'authLogin',
  tags: ['Auth'],
  summary: 'Log in',
  security: [], // public
  request: { body: { content: json(loginSchema), required: true } },
  responses: {
    200: { description: 'Authenticated', content: json(AuthResult) },
    ...validationErr,
    401: { description: 'INVALID_CREDENTIALS (email existence is not disclosed)', content: json(ErrorResponse) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  operationId: 'authRefresh',
  tags: ['Auth'],
  summary: 'Rotate tokens',
  description: 'The presented refresh token is revoked (rotation); reusing it returns 401.',
  security: [], // public — the refresh token in the body is the credential
  request: { body: { content: json(refreshSchema), required: true } },
  responses: {
    200: { description: 'New token pair', content: json(AuthResult) },
    ...validationErr,
    ...unauthorized,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  operationId: 'authLogout',
  tags: ['Auth'],
  summary: 'Log out',
  description: 'Revokes the given refresh token, or all of the user’s sessions if the body is omitted.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: false,
      content: json(z.object({ refreshToken: z.string().min(10).optional() })),
    },
  },
  responses: {
    200: { description: 'Logged out', content: json(z.object({ data: z.object({ success: z.boolean() }) })) },
    ...unauthorized,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  operationId: 'authMe',
  tags: ['Auth'],
  summary: 'Current user',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: 'The authenticated user', content: json(dataOf(PublicUser)) },
    ...unauthorized,
  },
});

// ---------------------------------------------------------------------------
// Paths — Companies
// ---------------------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/companies/me',
  operationId: 'companiesGetMine',
  tags: ['Companies'],
  summary: 'Get the caller’s company',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: 'Your company', content: json(dataOf(Company)) },
    ...unauthorized,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/companies/me',
  operationId: 'companiesRename',
  tags: ['Companies'],
  summary: 'Rename the company (admin only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: json(renameCompanySchema), required: true } },
  responses: {
    200: { description: 'Updated', content: json(dataOf(Company)) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
  },
});

registry.registerPath({
  method: 'post',
  path: '/companies',
  operationId: 'companiesCreate',
  tags: ['Companies'],
  summary: 'Not supported here',
  description: 'Returns 400 pointing to POST /auth/register with `companyName`.',
  security: [{ [bearerAuth.name]: [] }],
  responses: { 400: errRef, ...unauthorized },
});

registry.registerPath({
  method: 'post',
  path: '/companies/join',
  operationId: 'companiesJoin',
  tags: ['Companies'],
  summary: 'Not supported',
  description: 'A user belongs to exactly one company, chosen at registration (POST /auth/register with `companyId`).',
  security: [{ [bearerAuth.name]: [] }],
  responses: { 400: errRef, ...unauthorized },
});

// ---------------------------------------------------------------------------
// Paths — Users (admin only)
// ---------------------------------------------------------------------------
const idParam = registry.registerParameter(
  'IdPathParam',
  z
    .string()
    .uuid()
    .openapi({ param: { name: 'id', in: 'path' }, example: '3f1c9e7a-2b4d-4c8e-9f10-6a2b7c1d0e5f' }),
);
const pageParam = z.coerce.number().int().positive().optional().openapi({ param: { name: 'page', in: 'query' } });
const pageSizeParam = z.coerce
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .openapi({ param: { name: 'pageSize', in: 'query' } });

registry.registerPath({
  method: 'get',
  path: '/users',
  operationId: 'usersList',
  tags: ['Users (admin)'],
  summary: 'List company users',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: z.object({ page: pageParam, pageSize: pageSizeParam }) },
  responses: {
    200: { description: 'Users in your company', content: json(listOf(PublicUser)) },
    ...unauthorized,
    ...forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  operationId: 'usersGetById',
  tags: ['Users (admin)'],
  summary: 'Get a company user',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: idParam }) },
  responses: {
    200: { description: 'User', content: json(dataOf(PublicUser)) },
    ...unauthorized,
    ...forbidden,
    ...notFound,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  operationId: 'usersUpdate',
  tags: ['Users (admin)'],
  summary: 'Update a user',
  description:
    'At least one field required. An admin cannot change their own role away from `admin` (400).',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: idParam }),
    body: { content: json(updateUserSchema), required: true },
  },
  responses: {
    200: { description: 'Updated', content: json(dataOf(PublicUser)) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
    ...notFound,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  operationId: 'usersDelete',
  tags: ['Users (admin)'],
  summary: 'Delete a user',
  description:
    'Cannot delete yourself (400), the last admin (400), or a user who owns expenses (409, FK RESTRICT).',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: idParam }) },
  responses: {
    204: { description: 'Deleted' },
    400: errRef,
    ...unauthorized,
    ...forbidden,
    ...notFound,
    409: errRef,
  },
});

// ---------------------------------------------------------------------------
// Paths — Expenses
// ---------------------------------------------------------------------------
const createExpenseMultipart = z.object({
  amount: z.string().openapi({ example: '42.50' }),
  category: z.string().openapi({ example: 'Meals' }),
  expenseDate: z.string().openapi({ example: '2026-08-20' }),
  comment: z.string().optional(),
  receipt: z.string().openapi({ type: 'string', format: 'binary' }).optional(),
});

registry.registerPath({
  method: 'post',
  path: '/expenses',
  operationId: 'expensesCreate',
  tags: ['Expenses'],
  summary: 'Create an expense',
  description: 'multipart/form-data. Optional `receipt` file (jpeg/png/webp/heic/pdf, ≤ 5 MB). Created as `pending`.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { 'multipart/form-data': { schema: createExpenseMultipart } }, required: true },
  },
  responses: {
    201: { description: 'Created', content: json(dataOf(Expense)) },
    ...validationErr,
    ...unauthorized,
  },
});

registry.registerPath({
  method: 'get',
  path: '/expenses',
  operationId: 'expensesList',
  tags: ['Expenses'],
  summary: 'List expenses',
  description:
    'Employees see only their own rows; managers/admins see the whole company. ' +
    '`scope=team` is 403 for employees.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    query: z.object({
      scope: z.enum(['me', 'team']).optional().openapi({ param: { name: 'scope', in: 'query' } }),
      status: StatusEnum.optional().openapi({ param: { name: 'status', in: 'query' } }),
      category: z.string().optional().openapi({ param: { name: 'category', in: 'query' } }),
      dateFrom: z.string().optional().openapi({ param: { name: 'dateFrom', in: 'query' }, example: '2026-08-01' }),
      dateTo: z.string().optional().openapi({ param: { name: 'dateTo', in: 'query' }, example: '2026-08-31' }),
      page: pageParam,
      pageSize: pageSizeParam,
    }),
  },
  responses: {
    200: { description: 'Expenses', content: json(listOf(Expense)) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/expenses/{id}',
  operationId: 'expensesGetById',
  tags: ['Expenses'],
  summary: 'Get an expense',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: idParam }) },
  responses: {
    200: { description: 'Expense', content: json(dataOf(Expense)) },
    ...unauthorized,
    404: { description: 'Not found (also returned for another tenant’s expense, or a non-owner employee)', content: json(ErrorResponse) },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/expenses/{id}',
  operationId: 'expensesUpdate',
  tags: ['Expenses'],
  summary: 'Update an expense',
  description: 'Owner only, and only while `status === "pending"` (422 otherwise). At least one field required.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: idParam }),
    body: { content: json(updateExpenseSchema), required: true },
  },
  responses: {
    200: { description: 'Updated', content: json(dataOf(Expense)) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
    ...notFound,
    422: errRef,
  },
});

registry.registerPath({
  method: 'post',
  path: '/expenses/{id}/submit',
  operationId: 'expensesSubmit',
  tags: ['Expenses'],
  summary: 'Submit / resubmit for approval',
  description: 'Owner only. Moves `rejected → pending`. No-op if already pending. 422 if approved.',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: idParam }) },
  responses: {
    200: { description: 'Now pending', content: json(dataOf(Expense)) },
    ...unauthorized,
    ...forbidden,
    ...notFound,
    422: errRef,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/expenses/{id}/status',
  operationId: 'expensesSetStatus',
  tags: ['Expenses'],
  summary: 'Approve or reject (manager / admin)',
  description:
    'Only a `pending` expense can transition (422 otherwise). A manager cannot action their own ' +
    'expense (403); an admin can.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ id: idParam }),
    body: { content: json(setStatusSchema), required: true },
  },
  responses: {
    200: { description: 'Updated', content: json(dataOf(Expense)) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
    ...notFound,
    422: errRef,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/expenses/{id}',
  operationId: 'expensesDelete',
  tags: ['Expenses'],
  summary: 'Delete an expense',
  description: 'Owner or admin. An approved expense can only be deleted by an admin (422 for the owner).',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ id: idParam }) },
  responses: {
    204: { description: 'Deleted' },
    ...unauthorized,
    ...forbidden,
    ...notFound,
    422: errRef,
  },
});

// ---------------------------------------------------------------------------
// Paths — Analytics (manager / admin)
// ---------------------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/analytics/dashboard',
  operationId: 'analyticsDashboard',
  tags: ['Analytics (manager/admin)'],
  summary: 'Dashboard headline figures',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: 'Company dashboard', content: json(dataOf(Dashboard)) },
    ...unauthorized,
    ...forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/analytics/monthly',
  operationId: 'analyticsMonthly',
  tags: ['Analytics (manager/admin)'],
  summary: 'Monthly totals',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    query: z.object({
      months: z.coerce.number().int().positive().max(24).optional().openapi({ param: { name: 'months', in: 'query' }, example: 6 }),
    }),
  },
  responses: {
    200: { description: 'One point per month', content: json(dataOf(z.array(MonthlyPoint))) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/analytics/by-category',
  operationId: 'analyticsByCategory',
  tags: ['Analytics (manager/admin)'],
  summary: 'Totals by category',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    query: z.object({
      dateFrom: z.string().optional().openapi({ param: { name: 'dateFrom', in: 'query' }, example: '2026-08-01' }),
      dateTo: z.string().optional().openapi({ param: { name: 'dateTo', in: 'query' }, example: '2026-08-31' }),
    }),
  },
  responses: {
    200: { description: 'One row per category', content: json(dataOf(z.array(CategoryPoint))) },
    ...validationErr,
    ...unauthorized,
    ...forbidden,
  },
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
registry.registerPath({
  method: 'get',
  path: '/health',
  operationId: 'health',
  tags: ['Health'],
  summary: 'Liveness probe',
  security: [], // public
  responses: {
    200: {
      description: 'OK',
      content: json(z.object({ data: z.object({ status: z.literal('ok'), ts: z.string().datetime() }) })),
    },
  },
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Multi-Tenant Expense Management API',
      version: '1.0.0',
      description:
        'Company-scoped expense tracking and approval. All responses use a ' +
        '`{ data, meta? }` envelope; errors use `{ error: { code, message, details? } }`. ' +
        'Money is always a decimal string. Send `Authorization: Bearer <accessToken>` on protected routes.',
      license: { name: 'UNLICENSED (client-owned)' },
    },
    servers: [{ url: `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api`, description: env.NODE_ENV }],
    tags: [
      { name: 'Auth', description: 'Registration, login, token rotation, current user.' },
      { name: 'Companies', description: 'The caller’s own company. Create/join happens at registration.' },
      { name: 'Users (admin)', description: 'Company user management. Admin role required for every route.' },
      { name: 'Expenses', description: 'Create, list, edit, submit, approve/reject and delete expenses.' },
      {
        name: 'Analytics (manager/admin)',
        description: 'Company-scoped aggregates for the dashboard and reports.',
      },
      { name: 'Health', description: 'Liveness probe.' },
    ],
  });
}

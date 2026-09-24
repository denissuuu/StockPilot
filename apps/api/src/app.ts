import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env, corsOrigins } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { ensureRedisConnection, redis } from './lib/redis.js';
import { normalizeError } from './lib/errors.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { organizationRoutes } from './modules/organizations/organization.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { categoryRoutes } from './modules/catalog/category.routes.js';
import { productRoutes } from './modules/catalog/product.routes.js';
import { supplierRoutes } from './modules/suppliers/supplier.routes.js';
import { customerRoutes } from './modules/customers/customer.routes.js';
import { stockRoutes } from './modules/stock/stock.routes.js';
import { purchaseRoutes } from './modules/purchases/purchase.routes.js';
import { saleRoutes } from './modules/sales/sale.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { exportRoutes } from './modules/exports/export.routes.js';
import { openApiSchemas } from './openapi.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 1_048_576,
    genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
  });

  await app.register(cookie, { secret: env.JWT_ACCESS_SECRET });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origine non autorisée'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: ['127.0.0.1'],
  });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'StockPilot API',
        description: 'API REST de gestion des stocks, des achats et des ventes avec isolation par organisation.',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1', description: 'API REST StockPilot' }],
      tags: [
        { name: 'Authentification' }, { name: 'Organisation' }, { name: 'Utilisateurs' }, { name: 'Catalogue' },
        { name: 'Produits' }, { name: 'Stock' }, { name: 'Fournisseurs' }, { name: 'Clients' },
        { name: 'Achats' }, { name: 'Ventes' }, { name: 'Dashboard' }, { name: 'Exports' }, { name: 'Santé' },
      ],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: openApiSchemas as unknown as Record<string, any>,
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });

  await authPlugin(app);

  app.get(
    '/health/live',
    { schema: { tags: ['Santé'], summary: 'Liveness probe' } },
    async (_request, reply) => reply.send({ status: 'ok', service: 'stockpilot-api', timestamp: new Date().toISOString() }),
  );
  app.get('/health/ready', { schema: { tags: ['Santé'], summary: 'Readiness probe' } }, async (_request, reply) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      ensureRedisConnection().then(() => redis.ping()),
    ]);
    const database = checks[0].status === 'fulfilled';
    const cache = checks[1].status === 'fulfilled';
    const status = database && cache ? 'ready' : 'not_ready';
    const body = { status, service: 'stockpilot-api', timestamp: new Date().toISOString(), checks: { database: database ? 'ok' : 'error', redis: cache ? 'ok' : 'error' } };
    return reply.code(database && cache ? 200 : 503).send(body);
  });
  app.get('/health', { schema: { tags: ['Santé'], summary: 'Alias health check' } }, async (_request, reply) => reply.send({ status: 'ok', service: 'stockpilot-api', timestamp: new Date().toISOString() }));

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route introuvable', requestId: request.id } }));
  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);
    if (normalized.statusCode >= 500) request.log.error({ err: error }, 'Erreur non gérée');
    return reply.code(normalized.statusCode).send({
      success: false,
      error: { code: normalized.code, message: normalized.message, ...(normalized.details === undefined ? {} : { details: normalized.details }), requestId: request.id },
    });
  });

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(productRoutes, { prefix: '/api/v1/products' });
  await app.register(supplierRoutes, { prefix: '/api/v1/suppliers' });
  await app.register(customerRoutes, { prefix: '/api/v1/customers' });
  await app.register(stockRoutes, { prefix: '/api/v1' });
  await app.register(purchaseRoutes, { prefix: '/api/v1/purchase-orders' });
  await app.register(saleRoutes, { prefix: '/api/v1/sales' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(exportRoutes, { prefix: '/api/v1/exports' });
  await app.register(exportRoutes, { prefix: '/api/v1/export' });

  app.get('/openapi.json', async () => app.swagger());

  return app;
}

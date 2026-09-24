import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeAdjustment, serializeMovement } from '../../lib/serializers.js';
import { openApiProtected } from '../../openapi.js';
import { createAdjustmentSchema, createInitialStockSchema, listAdjustmentsSchema, listMovementsSchema } from './stock.schemas.js';
import { createAdjustment, createInitialStock, listAdjustments, listMovements } from './stock.service.js';

export async function stockRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Stock'], ...openApiProtected } };
  const write = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER', 'EMPLOYEE'])], schema: { tags: ['Stock'], ...openApiProtected } };

  app.get('/stock-movements', { ...read, schema: { ...read.schema, summary: 'Lister les mouvements de stock immuables' } }, async (request, reply) => {
    const result = await listMovements(request.authUser.organizationId, parse(listMovementsSchema, request.query));
    return sendPage(reply, result.movements.map(serializeMovement), result.meta);
  });

  app.get('/stock-adjustments', { ...read, schema: { ...read.schema, summary: 'Lister les ajustements de stock' } }, async (request, reply) => {
    const result = await listAdjustments(request.authUser.organizationId, parse(listAdjustmentsSchema, request.query));
    return sendPage(reply, result.adjustments.map(serializeAdjustment), result.meta);
  });

  app.post(
    '/stock-movements/initial',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Enregistrer le stock initial (une seule fois)',
        body: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', exclusiveMinimum: 0 },
            unitCost: { type: 'number', minimum: 0 },
            note: { type: 'string', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const movement = await createInitialStock(request.authUser.organizationId, request.authUser.id, parse(createInitialStockSchema, request.body));
      return sendData(reply, serializeMovement(movement), 201);
    },
  );

  app.post(
    '/stock-adjustments',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer un ajustement de stock transactionnel',
        description: 'Crée simultanément un mouvement immuable et sa trace d’audit. Une quantité négative retire du stock.',
        body: {
          type: 'object',
          required: ['productId', 'quantity', 'reason'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number', description: 'Quantité signée, différente de zéro' },
            reason: { type: 'string', enum: ['DAMAGE', 'EXPIRY', 'THEFT', 'COUNT_CORRECTION', 'FOUND', 'OTHER'] },
            note: { type: 'string', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const adjustment = await createAdjustment(request.authUser.organizationId, request.authUser.id, parse(createAdjustmentSchema, request.body));
      return sendData(reply, serializeAdjustment(adjustment), 201);
    },
  );
}

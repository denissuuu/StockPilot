import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeSale } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createSaleSchema, listSalesSchema } from './sale.schemas.js';
import { cancelSale, createSale, getSale, listSales } from './sale.service.js';

const saleLineProperties = {
  productId: { type: 'string', format: 'uuid' },
  quantity: { type: 'number', exclusiveMinimum: 0 },
  unitPrice: { type: 'number', minimum: 0 },
  discountPercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
  taxRate: { type: 'number', minimum: 0, maximum: 100 },
} as const;

export async function saleRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Ventes'], ...openApiProtected } };
  const write = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER', 'EMPLOYEE'])], schema: { tags: ['Ventes'], ...openApiProtected } };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les ventes' } }, async (request, reply) => {
    const result = await listSales(request.authUser.organizationId, parse(listSalesSchema, request.query));
    return sendPage(reply, result.sales.map(serializeSale), result.meta);
  });

  app.post(
    '/',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer une vente et sortir le stock transactionnellement',
        body: {
          type: 'object',
          required: ['lines'],
          properties: {
            customerId: { type: 'string', format: 'uuid', nullable: true },
            reference: { type: 'string', nullable: true },
            soldAt: { type: 'string', format: 'date-time' },
            notes: { type: 'string', nullable: true },
            lines: { type: 'array', minItems: 1, items: { type: 'object', required: ['productId', 'quantity'], properties: saleLineProperties } },
          },
        },
      },
    },
    async (request, reply) => {
      const sale = await createSale(request.authUser.organizationId, request.authUser.id, parse(createSaleSchema, request.body));
      return sendData(reply, serializeSale(sale), 201);
    },
  );

  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir une vente', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializeSale(await getSale(request.authUser.organizationId, id)));
  });

  app.post('/:id/cancel', { ...write, schema: { ...write.schema, summary: 'Annuler une vente et réintégrer le stock', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializeSale(await cancelSale(request.authUser.organizationId, id, request.authUser.id)));
  });
}

import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializePurchaseOrder } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createPurchaseOrderSchema, listPurchaseOrdersSchema, receivePurchaseOrderSchema, updatePurchaseOrderSchema } from './purchase.schemas.js';
import { cancelPurchaseOrder, createPurchaseOrder, getPurchaseOrder, listPurchaseOrders, markPurchaseOrderOrdered, receivePurchaseOrder, updatePurchaseOrder } from './purchase.service.js';

const purchaseLineProperties = {
  productId: { type: 'string', format: 'uuid' },
  quantity: { type: 'number', exclusiveMinimum: 0 },
  unitCost: { type: 'number', minimum: 0 },
  discountPercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
  taxRate: { type: 'number', minimum: 0, maximum: 100, default: 20 },
} as const;

const receiptLineProperties = {
  lineId: { type: 'string', format: 'uuid' },
  quantity: { type: 'number', exclusiveMinimum: 0 },
} as const;

export async function purchaseRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Achats'], ...openApiProtected } };
  const write = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])], schema: { tags: ['Achats'], ...openApiProtected } };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les commandes fournisseurs' } }, async (request, reply) => {
    const result = await listPurchaseOrders(request.authUser.organizationId, parse(listPurchaseOrdersSchema, request.query));
    return sendPage(reply, result.orders.map(serializePurchaseOrder), result.meta);
  });

  app.post(
    '/',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer une commande fournisseur',
        body: {
          type: 'object',
          required: ['supplierId', 'lines'],
          properties: {
            supplierId: { type: 'string', format: 'uuid' },
            reference: { type: 'string', nullable: true },
            expectedAt: { type: 'string', format: 'date-time', nullable: true },
            notes: { type: 'string', nullable: true },
            lines: { type: 'array', minItems: 1, items: { type: 'object', required: ['productId', 'quantity', 'unitCost'], properties: purchaseLineProperties } },
          },
        },
      },
    },
    async (request, reply) => {
      const order = await createPurchaseOrder(request.authUser.organizationId, request.authUser.id, parse(createPurchaseOrderSchema, request.body));
      return sendData(reply, serializePurchaseOrder(order), 201);
    },
  );

  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir une commande fournisseur', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializePurchaseOrder(await getPurchaseOrder(request.authUser.organizationId, id)));
  });

  app.patch('/:id', { ...write, schema: { ...write.schema, summary: 'Modifier une commande brouillon', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const order = await updatePurchaseOrder(request.authUser.organizationId, id, parse(updatePurchaseOrderSchema, request.body));
    return sendData(reply, serializePurchaseOrder(order));
  });

  app.post('/:id/order', { ...write, schema: { ...write.schema, summary: 'Marquer une commande comme transmise', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializePurchaseOrder(await markPurchaseOrderOrdered(request.authUser.organizationId, id)));
  });

  app.post(
    '/:id/receive',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Réceptionner transactionnellement des lignes',
        params: openApiIdParam,
        body: {
          type: 'object',
          required: ['lines'],
          properties: {
            receivedAt: { type: 'string', format: 'date-time' },
            lines: { type: 'array', minItems: 1, items: { type: 'object', required: ['lineId', 'quantity'], properties: receiptLineProperties } },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parse(uuidSchema, (request.params as { id: string }).id);
      const order = await receivePurchaseOrder(request.authUser.organizationId, id, request.authUser.id, parse(receivePurchaseOrderSchema, request.body));
      return sendData(reply, serializePurchaseOrder(order));
    },
  );

  app.post('/:id/cancel', { ...write, schema: { ...write.schema, summary: 'Annuler une commande non reçue', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializePurchaseOrder(await cancelPurchaseOrder(request.authUser.organizationId, id)));
  });
}

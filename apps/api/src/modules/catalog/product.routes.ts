import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeMovement, serializeProduct } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createProductSchema, listProductsSchema, updateProductSchema } from './product.schemas.js';
import { createProduct, deactivateProduct, getProduct, getProductAlerts, getProductByBarcode, getProductStock, listProducts, updateProduct } from './product.service.js';

export async function productRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Produits'], ...openApiProtected } };
  const write = {
    preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])],
    schema: { tags: ['Produits'], ...openApiProtected },
  };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les produits et leur stock' } }, async (request, reply) => {
    const input = parse(listProductsSchema, request.query);
    const result = await listProducts(request.authUser.organizationId, input);
    return sendPage(
      reply,
      result.products.map(({ product, stock }) => serializeProduct(product, stock)),
      result.meta,
    );
  });

  app.get('/alerts', { ...read, schema: { ...read.schema, summary: 'Lister les produits sous le seuil d’alerte' } }, async (request, reply) => {
    const alerts = await getProductAlerts(request.authUser.organizationId);
    return sendData(reply, alerts.map(({ product, stock }) => serializeProduct(product, stock)));
  });

  app.get('/barcode/:barcode', { ...read, schema: { ...read.schema, summary: 'Rechercher un produit par code-barres', params: { type: 'object', required: ['barcode'], properties: { barcode: { type: 'string', maxLength: 80 } } } } }, async (request, reply) => {
    const barcode = decodeURIComponent((request.params as { barcode: string }).barcode);
    const result = await getProductByBarcode(request.authUser.organizationId, barcode);
    return sendData(reply, serializeProduct(result.product, result.stock));
  });

  app.post(
    '/',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer un produit',
        body: {
          type: 'object',
          required: ['sku', 'name', 'costPrice', 'salePrice'],
          properties: {
            sku: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            barcode: { type: 'string', nullable: true },
            categoryId: { type: 'string', format: 'uuid', nullable: true },
            unit: { type: 'string' },
            costPrice: { type: 'number', minimum: 0 },
            salePrice: { type: 'number', minimum: 0 },
            taxRate: { type: 'number', minimum: 0, maximum: 100 },
            minStock: { type: 'number', minimum: 0 },
            maxStock: { type: 'number', minimum: 0, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const product = await createProduct(request.authUser.organizationId, parse(createProductSchema, request.body));
      return sendData(reply, serializeProduct(product, 0), 201);
    },
  );

  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir un produit', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const result = await getProduct(request.authUser.organizationId, id);
    return sendData(reply, serializeProduct(result.product, result.stock));
  });

  app.get('/:id/stock', { ...read, schema: { ...read.schema, summary: 'Consulter le stock et les derniers mouvements', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const result = await getProductStock(request.authUser.organizationId, id);
    return sendData(reply, {
      product: serializeProduct(result.product, result.stock),
      stock: Number(result.stock.toString()),
      movements: result.movements.map(serializeMovement),
    });
  });

  app.patch('/:id', { ...write, schema: { ...write.schema, summary: 'Modifier un produit', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const product = await updateProduct(request.authUser.organizationId, id, parse(updateProductSchema, request.body));
    const stock = await getProduct(request.authUser.organizationId, id);
    return sendData(reply, serializeProduct(product, stock.stock));
  });

  app.delete('/:id', { ...write, schema: { ...write.schema, summary: 'Désactiver un produit', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    await deactivateProduct(request.authUser.organizationId, id);
    return sendData(reply, { deactivated: true });
  });
}

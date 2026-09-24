import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeCategory } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createCategorySchema, listCategoriesSchema, updateCategorySchema } from './category.schemas.js';
import { createCategory, deleteCategory, getCategory, listCategories, updateCategory } from './category.service.js';

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Catalogue'], summary: 'Lister les catégories', ...openApiProtected } };
  const write = {
    preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])],
    schema: { tags: ['Catalogue'], summary: 'Gérer les catégories', ...openApiProtected },
  };

  app.get('/', read, async (request, reply) => {
    const input = parse(listCategoriesSchema, request.query);
    const result = await listCategories(request.authUser.organizationId, input);
    return sendPage(reply, result.categories.map(serializeCategory), result.meta);
  });

  app.post(
    '/',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer une catégorie',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            parentId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const category = await createCategory(request.authUser.organizationId, parse(createCategorySchema, request.body));
      return sendData(reply, serializeCategory(category), 201);
    },
  );

  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir une catégorie', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializeCategory(await getCategory(request.authUser.organizationId, id)));
  });

  app.patch('/:id', { ...write, schema: { ...write.schema, summary: 'Modifier une catégorie', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const category = await updateCategory(request.authUser.organizationId, id, parse(updateCategorySchema, request.body));
    return sendData(reply, serializeCategory(category));
  });

  app.delete('/:id', { ...write, schema: { ...write.schema, summary: 'Supprimer une catégorie', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    await deleteCategory(request.authUser.organizationId, id);
    return sendData(reply, { deactivated: true });
  });
}

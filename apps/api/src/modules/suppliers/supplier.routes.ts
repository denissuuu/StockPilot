import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeSupplier } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createSupplierSchema, listSuppliersSchema, updateSupplierSchema } from './supplier.schemas.js';
import { createSupplier, deactivateSupplier, getSupplier, listSuppliers, updateSupplier } from './supplier.service.js';

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Fournisseurs'], ...openApiProtected } };
  const write = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])], schema: { tags: ['Fournisseurs'], ...openApiProtected } };
  const contactProperties = {
    name: { type: 'string' }, email: { type: 'string', format: 'email', nullable: true }, phone: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true }, taxId: { type: 'string', nullable: true }, isActive: { type: 'boolean' },
  };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les fournisseurs' } }, async (request, reply) => {
    const result = await listSuppliers(request.authUser.organizationId, parse(listSuppliersSchema, request.query));
    return sendPage(reply, result.suppliers.map(serializeSupplier), result.meta);
  });
  app.post('/', { ...write, schema: { ...write.schema, summary: 'Créer un fournisseur', body: { type: 'object', required: ['name'], properties: contactProperties } } }, async (request, reply) => {
    const supplier = await createSupplier(request.authUser.organizationId, parse(createSupplierSchema, request.body));
    return sendData(reply, serializeSupplier(supplier), 201);
  });
  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir un fournisseur', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializeSupplier(await getSupplier(request.authUser.organizationId, id)));
  });
  app.patch('/:id', { ...write, schema: { ...write.schema, summary: 'Modifier un fournisseur', params: openApiIdParam, body: { type: 'object', properties: contactProperties } } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const supplier = await updateSupplier(request.authUser.organizationId, id, parse(updateSupplierSchema, request.body));
    return sendData(reply, serializeSupplier(supplier));
  });
  app.delete('/:id', { ...write, schema: { ...write.schema, summary: 'Désactiver un fournisseur', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    await deactivateSupplier(request.authUser.organizationId, id);
    return sendData(reply, { deactivated: true });
  });
}

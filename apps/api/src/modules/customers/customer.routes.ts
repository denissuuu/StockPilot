import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { serializeCustomer } from '../../lib/serializers.js';
import { openApiIdParam, openApiProtected } from '../../openapi.js';
import { createCustomerSchema, listCustomersSchema, updateCustomerSchema } from './customer.schemas.js';
import { createCustomer, deactivateCustomer, getCustomer, listCustomers, updateCustomer } from './customer.service.js';

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Clients'], ...openApiProtected } };
  const write = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER', 'EMPLOYEE'])], schema: { tags: ['Clients'], ...openApiProtected } };
  const properties = {
    name: { type: 'string' }, email: { type: 'string', format: 'email', nullable: true }, phone: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true }, taxId: { type: 'string', nullable: true }, isActive: { type: 'boolean' },
  };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les clients' } }, async (request, reply) => {
    const result = await listCustomers(request.authUser.organizationId, parse(listCustomersSchema, request.query));
    return sendPage(reply, result.customers.map(serializeCustomer), result.meta);
  });
  app.post('/', { ...write, schema: { ...write.schema, summary: 'Créer un client', body: { type: 'object', required: ['name'], properties } } }, async (request, reply) => {
    const customer = await createCustomer(request.authUser.organizationId, parse(createCustomerSchema, request.body));
    return sendData(reply, serializeCustomer(customer), 201);
  });
  app.get('/:id', { ...read, schema: { ...read.schema, summary: 'Obtenir un client', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    return sendData(reply, serializeCustomer(await getCustomer(request.authUser.organizationId, id)));
  });
  app.patch('/:id', { ...write, schema: { ...write.schema, summary: 'Modifier un client', params: openApiIdParam, body: { type: 'object', properties } } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    const customer = await updateCustomer(request.authUser.organizationId, id, parse(updateCustomerSchema, request.body));
    return sendData(reply, serializeCustomer(customer));
  });
  app.delete('/:id', { ...write, schema: { ...write.schema, summary: 'Désactiver un client', params: openApiIdParam } }, async (request, reply) => {
    const id = parse(uuidSchema, (request.params as { id: string }).id);
    await deactivateCustomer(request.authUser.organizationId, id);
    return sendData(reply, { deactivated: true });
  });
}

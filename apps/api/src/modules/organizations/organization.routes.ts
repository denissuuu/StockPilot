import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData } from '../../lib/response.js';
import { openApiProtected } from '../../openapi.js';
import { updateOrganizationSchema } from './organization.schemas.js';
import { getOrganization, updateOrganization } from './organization.service.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: [app.authenticate], schema: { tags: ['Organisation'], summary: 'Obtenir l’organisation courante', ...openApiProtected } },
    async (request, reply) => {
      const organization = await getOrganization(request.authUser.organizationId);
      return sendData(reply, serializeOrganization(organization));
    },
  );

  app.get(
    '/:id',
    { preHandler: [app.authenticate], schema: { tags: ['Organisation'], summary: 'Obtenir une organisation de son tenant', ...openApiProtected, params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } },
    async (request, reply) => {
      const id = parse(uuidSchema, (request.params as { id: string }).id);
      if (id !== request.authUser.organizationId) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Organisation introuvable', requestId: request.id } });
      return sendData(reply, serializeOrganization(await getOrganization(id)));
    },
  );

  app.patch(
    '/',
    {
      preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])],
      schema: {
        tags: ['Organisation'],
        summary: 'Modifier l’organisation courante',
        ...openApiProtected,
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 160 },
            legalName: { type: 'string', nullable: true },
            taxId: { type: 'string', nullable: true },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            timezone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = parse(updateOrganizationSchema, request.body);
      const organization = await updateOrganization(request.authUser.organizationId, input);
      return sendData(reply, serializeOrganization(organization));
    },
  );
}

function serializeOrganization(organization: any): Record<string, unknown> {
  return {
    id: organization.id,
    companyId: organization.id,
    name: organization.name,
    legalName: organization.legalName,
    taxId: organization.taxId,
    currency: organization.currency,
    timezone: organization.timezone,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validation.js';
import { openApiProtected } from '../../openapi.js';
import { buildCsvExport, type ExportType } from './export.service.js';

const exportQuerySchema = z.object({
  type: z.enum(['products', 'sales', 'stock-movements']),
  search: z.string().trim().max(120).optional(),
});

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  const options = (summary: string) => ({
    preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'])],
    schema: {
      tags: ['Exports'],
      summary,
      ...openApiProtected,
      response: { ...openApiProtected.response, 200: { type: 'string' } },
      querystring: { type: 'object', properties: { search: { type: 'string' } } },
    },
  });

  app.get(
    '/',
    {
      ...options('Exporter des données en CSV'),
      schema: {
        ...options('Exporter des données en CSV').schema,
        querystring: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['products', 'sales', 'stock-movements'] }, search: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const input = parse(exportQuerySchema, request.query);
      return sendCsv(reply, request.authUser.organizationId, input.type, input.search);
    },
  );

  app.get('/products.csv', options('Exporter les produits en CSV'), async (request, reply) => sendCsv(reply, request.authUser.organizationId, 'products', (request.query as { search?: string }).search));
  app.get('/sales.csv', options('Exporter les ventes en CSV'), async (request, reply) => sendCsv(reply, request.authUser.organizationId, 'sales', (request.query as { search?: string }).search));
  app.get('/stock-movements.csv', options('Exporter les mouvements de stock en CSV'), async (request, reply) => sendCsv(reply, request.authUser.organizationId, 'stock-movements', (request.query as { search?: string }).search));
}

async function sendCsv(reply: FastifyReply, organizationId: string, type: ExportType, search?: string): Promise<FastifyReply> {
  const result = await buildCsvExport(organizationId, type, search);
  return reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${result.filename}"`)
    .send(result.content);
}

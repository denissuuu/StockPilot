import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validation.js';
import { sendData } from '../../lib/response.js';
import { openApiProtected } from '../../openapi.js';
import { dashboardSchema } from './dashboard.schemas.js';
import { getDashboard } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: [app.authenticate], schema: { tags: ['Dashboard'], summary: 'KPIs, marges et séries temporelles', ...openApiProtected, querystring: { type: 'object', properties: { from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' }, granularity: { type: 'string', enum: ['day', 'week', 'month'] } } } } },
    async (request, reply) => sendData(reply, await getDashboard(request.authUser.organizationId, parse(dashboardSchema, request.query))),
  );
}

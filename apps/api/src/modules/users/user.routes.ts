import type { FastifyInstance } from 'fastify';
import { parse, uuidSchema } from '../../lib/validation.js';
import { sendData, sendPage } from '../../lib/response.js';
import { openApiProtected, openApiIdParam } from '../../openapi.js';
import { serializeUser } from '../../lib/serializers.js';
import { createUserSchema, listUsersSchema, updateUserSchema } from './user.schemas.js';
import { createUser, deactivateUser, getUser, listUsers, updateUser } from './user.service.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate], schema: { tags: ['Utilisateurs'], ...openApiProtected } };
  const write = {
    preHandler: [app.authenticate, app.authorize(['ADMIN', 'MANAGER'])],
    schema: { tags: ['Utilisateurs'], ...openApiProtected },
  };

  app.get('/', { ...read, schema: { ...read.schema, summary: 'Lister les utilisateurs' } }, async (request, reply) => {
    const input = parse(listUsersSchema, request.query);
    const result = await listUsers(request.authUser.organizationId, input);
    return sendPage(reply, result.users.map(serializeUser), result.meta);
  });

  app.post(
    '/',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Créer un utilisateur',
        body: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'] },
          },
        },
      },
    },
    async (request, reply) => {
      const input = parse(createUserSchema, request.body);
      const user = await createUser(request.authUser.organizationId, request.authUser.role, input);
      return sendData(reply, serializeUser(user), 201);
    },
  );

  app.get(
    '/:id',
    { ...read, schema: { ...read.schema, summary: 'Obtenir un utilisateur', params: openApiIdParam } },
    async (request, reply) => {
      const id = parse(uuidSchema, (request.params as { id: string }).id);
      return sendData(reply, serializeUser(await getUser(request.authUser.organizationId, id)));
    },
  );

  app.patch(
    '/:id',
    {
      ...write,
      schema: {
        ...write.schema,
        summary: 'Modifier un utilisateur',
        params: openApiIdParam,
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'] },
            isActive: { type: 'boolean' },
            password: { type: 'string', format: 'password' },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parse(uuidSchema, (request.params as { id: string }).id);
      const input = parse(updateUserSchema, request.body);
      const user = await updateUser(request.authUser.organizationId, id, request.authUser.id, request.authUser.role, input);
      return sendData(reply, serializeUser(user));
    },
  );

  app.delete(
    '/:id',
    { ...write, schema: { ...write.schema, summary: 'Désactiver un utilisateur', params: openApiIdParam } },
    async (request, reply) => {
      const id = parse(uuidSchema, (request.params as { id: string }).id);
      await deactivateUser(request.authUser.organizationId, id, request.authUser.id, request.authUser.role);
      return sendData(reply, { deactivated: true });
    },
  );
}

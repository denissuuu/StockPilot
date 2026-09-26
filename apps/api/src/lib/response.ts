import type { FastifyReply } from 'fastify';

/**
 * Enveloppe de réponse standard pour les opérations réussies.
 * Toutes les réponses de l'API suivent cette structure.
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export function sendData<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.code(statusCode).send({ success: true, data } satisfies SuccessResponse<T>);
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function sendPage<T>(
  reply: FastifyReply,
  data: T[],
  meta: PageMeta,
  statusCode = 200,
): FastifyReply {
  return reply.code(statusCode).send({ success: true, data, meta } satisfies SuccessResponse<T[]> & { meta: PageMeta });
}

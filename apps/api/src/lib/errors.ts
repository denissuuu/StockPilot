import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentification requise'): AppError =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Droits insuffisants'): AppError =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (resource = 'Ressource'): AppError =>
  new AppError(404, 'NOT_FOUND', `${resource} introuvable`);
export const conflict = (message: string): AppError => new AppError(409, 'CONFLICT', message);
export const unprocessable = (message: string, details?: unknown): AppError =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);

export function normalizeError(error: unknown): {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Les données envoyées sont invalides',
      details: error.flatten(),
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { statusCode: 409, code: 'CONFLICT', message: 'Une valeur identique existe déjà' };
    }
    if (error.code === 'P2025') {
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Ressource introuvable' };
    }
    if (error.code === 'P2003') {
      return { statusCode: 409, code: 'CONFLICT', message: 'Référence vers une ressource inexistante' };
    }
    if (error.code === 'P2011') {
      return { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Constraint de données invalide' };
    }
    if (error.code === 'P2034') {
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Conflit de transaction, veuillez réessayer',
      };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Erreur de validation des données' };
  }

  const maybeFastify = error as { statusCode?: number; code?: string; message?: string; validation?: unknown };
  if (maybeFastify.code === 'FST_ERR_VALIDATION' || maybeFastify.validation !== undefined) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La requête contient des champs invalides',
      details: maybeFastify.validation,
    };
  }
  if (maybeFastify.statusCode === 429 || maybeFastify.code === 'FST_ERR_RATE_LIMIT') {
    return { statusCode: 429, code: 'RATE_LIMITED', message: 'Trop de requêtes, réessayez plus tard' };
  }
  if (maybeFastify.statusCode && maybeFastify.statusCode >= 400 && maybeFastify.statusCode < 500) {
    return {
      statusCode: maybeFastify.statusCode,
      code: 'BAD_REQUEST',
      message: maybeFastify.message ?? 'Requête invalide',
    };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' };
}

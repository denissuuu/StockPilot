import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Schéma de validation pour les identifiants UUID v4.
 * Utilisé dans les paramètres de route et les corps de requête.
 */
export const uuidSchema = z.string().uuid();

/**
 * Capacité des colonnes NUMERIC de PostgreSQL, par famille de champ.
 * L'échelle d'une colonne est aussi le nombre de décimales qu'elle conserve :
 * borne le nombre de décimales comme l'ordre de grandeur des montants.
 */
export const NUMERIC_COLUMN = {
  /** Prix et coûts unitaires : NUMERIC(14,4). */
  unitAmount: { precision: 14, scale: 4 },
  /** Quantités et seuils de stock : NUMERIC(16,4). */
  quantity: { precision: 16, scale: 4 },
  /** Taux et remises : NUMERIC(6,3). */
  percent: { precision: 6, scale: 3 },
} as const;

export type NumericColumn = (typeof NUMERIC_COLUMN)[keyof typeof NUMERIC_COLUMN];

export function decimalPlaces(value: number, maximum: number): boolean {
  return new Prisma.Decimal(value).decimalPlaces() <= maximum;
}

/** Le nombre tient-il, signe compris, dans la colonne NUMERIC visée ? */
export function fitsColumn(value: number, column: NumericColumn): boolean {
  if (!Number.isFinite(value)) return false;
  return new Prisma.Decimal(value).abs().lt(new Prisma.Decimal(10).pow(column.precision - column.scale));
}

/** Plus grand magnitude que la colonne accepte, arrondi à l'unité pour le message. */
export function columnLimit(column: NumericColumn): Prisma.Decimal {
  return new Prisma.Decimal(10).pow(column.precision - column.scale).minus(1);
}

/**
 * Refinement zod : rejette une valeur que la colonne NUMERIC de destination ne
 * peut pas stocker, trop de décimales ou magnitude hors échelle.
 *
 * Sans la borne de magnitude, la validation laissait passer un montant que
 * PostgreSQL refuse à l'écriture : la requête se soldait par un 500 au lieu
 * d'un 400, et l'appelant n'avait aucun moyen de savoir quoi corriger.
 */
export function boundedByColumn(column: NumericColumn, label: string) {
  return (value: number, ctx: z.RefinementCtx): void => {
    if (!Number.isFinite(value)) return;
    if (!decimalPlaces(value, column.scale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} doit avoir au plus ${column.scale} décimales`,
      });
      return;
    }
    if (!fitsColumn(value, column)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} ne peut pas dépasser ${columnLimit(column).toString()}`,
      });
    }
  };
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
import { describe, expect, it } from 'vitest';
import { boundedDateRange, coherentDateRange, dateRangeSchema, isCoherentDateRange, wholeDayFilter } from '../src/lib/query.js';
import { dashboardSchema } from '../src/modules/dashboard/dashboard.schemas.js';
import { listPurchaseOrdersSchema } from '../src/modules/purchases/purchase.schemas.js';
import { listSalesSchema } from '../src/modules/sales/sale.schemas.js';
import { listAdjustmentsSchema, listMovementsSchema } from '../src/modules/stock/stock.schemas.js';

/** Tous les schémas qui filtrent sur une période. */
const periodFilters = {
  ventes: listSalesSchema,
  achats: listPurchaseOrdersSchema,
  mouvements: listMovementsSchema,
  ajustements: listAdjustmentsSchema,
  tableauDeBord: dashboardSchema,
};

const inverse = { from: '2026-03-10T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z' };
const ordre = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-10T00:00:00.000Z' };

describe('cohérence d’une période', () => {
  it('accepte une période ordonnée, une période à moitié fournie ou absente', () => {
    expect(isCoherentDateRange({ from: new Date('2026-01-01'), to: new Date('2026-02-01') })).toBe(true);
    expect(isCoherentDateRange({ from: new Date('2026-01-01') })).toBe(true);
    expect(isCoherentDateRange({})).toBe(true);
  });

  it('refuse une période inversée', () => {
    expect(isCoherentDateRange({ from: new Date('2026-02-01'), to: new Date('2026-01-01') })).toBe(false);
  });

  it('expose un seul message pour tous les appelants', () => {
    expect(coherentDateRange.message).toBe('La date de début doit être antérieure à la date de fin');
    expect(coherentDateRange.path).toEqual(['from']);
  });
});

describe('bornes de période partagées', () => {
  it.each(Object.entries(periodFilters))('%s refuse une période inversée', (_nom, schema) => {
    const parsed = schema.safeParse(inverse);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe(coherentDateRange.message);
    expect(parsed.error?.issues[0].path).toEqual(['from']);
  });

  it.each(Object.entries(periodFilters))('%s accepte une période ordonnée', (_nom, schema) => {
    expect(schema.safeParse(ordre).success).toBe(true);
  });

  it.each(Object.entries(periodFilters))('%s accepte une requête sans période', (_nom, schema) => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('laisse from et to facultatifs dans le schéma autonome', () => {
    expect(dateRangeSchema.safeParse({}).success).toBe(true);
    expect(dateRangeSchema.safeParse({ from: '2026-01-01' }).success).toBe(true);
  });
});

describe('wholeDayFilter', () => {
  const periode = { from: new Date('2026-03-01T18:30:00.000Z'), to: new Date('2026-03-10T09:15:00.000Z') };

  it('inclut la dernière journée demandée jusqu’à sa fin', () => {
    const { lte } = wholeDayFilter(periode);

    // Sans cet élargissement, la borne haute valait 2026-03-10T00:00 et le 10 disparaissait.
    expect(lte?.toISOString()).toBe('2026-03-10T23:59:59.999Z');
  });

  it('ouvre la première journée demandée dès son début', () => {
    expect(wholeDayFilter(periode).gte?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('couvre exactement les journées demandées', () => {
    const { gte, lte } = wholeDayFilter(periode);
    const jours = (lte!.getTime() - gte!.getTime()) / 86_400_000;

    // 10 journées, à la milliseconde près : endOfDay ferme à 23:59:59.999.
    expect(jours).toBeCloseTo(10, 5);
  });

  it('ne pose que la borne fournie', () => {
    expect(wholeDayFilter({ from: periode.from })).toEqual({ gte: new Date('2026-03-01T00:00:00.000Z') });
    expect(wholeDayFilter({ to: periode.to })).toEqual({ lte: new Date('2026-03-10T23:59:59.999Z') });
    expect(wholeDayFilter({})).toEqual({});
  });

  it('préserve la symétrie des bornes déjà à minuit et en fin de journée', () => {
    const entieres = { from: new Date('2026-03-01T00:00:00.000Z'), to: new Date('2026-03-10T23:59:59.999Z') };

    expect(wholeDayFilter(entieres)).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lte: new Date('2026-03-10T23:59:59.999Z'),
    });
  });
});

describe('boundedDateRange', () => {
  it('complète une période absente par les 90 derniers jours', () => {
    const to = new Date('2026-03-10T12:00:00.000Z');
    const { from, to: borne } = boundedDateRange({ to });

    expect(borne).toBe(to);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(90);
  });

  it('refuse une période plus longue que la fenêtre autorisée', () => {
    expect(() => boundedDateRange({ from: new Date('2025-01-01'), to: new Date('2026-03-10') })).toThrow(/366 jours/);
  });

  it('accepte une période exactement à la limite', () => {
    const to = new Date('2026-03-10T00:00:00.000Z');
    const from = new Date(to.getTime() - 366 * 86_400_000);

    expect(boundedDateRange({ from, to })).toEqual({ from, to });
  });
});
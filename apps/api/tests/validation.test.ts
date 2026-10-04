import { describe, expect, it } from 'vitest';
import { NUMERIC_COLUMN, columnLimit, decimalPlaces, fitsColumn } from '../src/lib/validation.js';
import { createProductSchema } from '../src/modules/catalog/product.schemas.js';
import { createSaleSchema } from '../src/modules/sales/sale.schemas.js';

const productId = '3f6c1c1e-8a2b-4c3d-9e4f-5a6b7c8d9e0f';

describe('capacité des colonnes NUMERIC', () => {
  it('déduit le nombre de décimales de l’échelle de la colonne', () => {
    expect(decimalPlaces(12.1234, 4)).toBe(true);
    expect(decimalPlaces(0, 4)).toBe(true);
    expect(decimalPlaces(0.00001, 4)).toBe(false);
  });

  it('accepte une valeur à l’intérieur de la colonne et refuse la suivante', () => {
    expect(fitsColumn(9999999999.9999, NUMERIC_COLUMN.unitAmount)).toBe(true);
    expect(fitsColumn(10000000000, NUMERIC_COLUMN.unitAmount)).toBe(false);
  });

  it('ignore le signe pour la borne de magnitude', () => {
    expect(fitsColumn(-9999999999.9999, NUMERIC_COLUMN.unitAmount)).toBe(true);
    expect(fitsColumn(-10000000000, NUMERIC_COLUMN.unitAmount)).toBe(false);
  });

  it('donne des limites qui tiennent dans la colonne', () => {
    expect(fitsColumn(columnLimit(NUMERIC_COLUMN.unitAmount).toNumber(), NUMERIC_COLUMN.unitAmount)).toBe(true);
    expect(fitsColumn(columnLimit(NUMERIC_COLUMN.percent).toNumber(), NUMERIC_COLUMN.percent)).toBe(true);
  });

  it('aligne les bornes déclarées sur celles du schéma Prisma', () => {
    // NUMERIC(14,4) pour les prix, NUMERIC(16,4) pour les quantités.
    expect(columnLimit(NUMERIC_COLUMN.unitAmount).toNumber()).toBe(9_999_999_999);
    expect(columnLimit(NUMERIC_COLUMN.quantity).toNumber()).toBe(999_999_999_999);
  });
});

describe('bornes des montants à la saisie', () => {
  const product = (overrides: Record<string, unknown> = {}) => ({
    sku: 'REF-1',
    name: 'Clavier',
    costPrice: 10,
    salePrice: 20,
    ...overrides,
  });

  it('accepte un prix à la limite exacte de la colonne', () => {
    expect(createProductSchema.safeParse(product({ salePrice: 9_999_999_999.9999 })).success).toBe(true);
  });

  it('refuse un prix que PostgreSQL ne pourrait pas stocker', () => {
    const parsed = createProductSchema.safeParse(product({ salePrice: 10_000_000_000 }));

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('Le prix de vente ne peut pas dépasser 9999999999');
  });

  it('refuse un seuil de stock hors de sa propre colonne', () => {
    // NUMERIC(16,4) : bien plus large que la colonne des prix.
    expect(createProductSchema.safeParse(product({ minStock: 999_999_999_999 })).success).toBe(true);
    expect(createProductSchema.safeParse(product({ minStock: 1_000_000_000_000 })).success).toBe(false);
  });

  it('refuse une quantité de vente hors échelle', () => {
    const parsed = createSaleSchema.safeParse({
      customerId: null,
      lines: [{ productId, quantity: 1_000_000_000_000, unitPrice: 10 }],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe('La quantité ne peut pas dépasser 999999999999');
  });

  it('signale la magnitude avant le nombre de décimales', () => {
    const parsed = createProductSchema.safeParse(product({ salePrice: 1e12 + 0.000_000_1 }));

    expect(parsed.error?.issues[0].message).toContain('ne peut pas dépasser');
  });
});
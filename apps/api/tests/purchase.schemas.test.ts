import { describe, expect, it } from 'vitest';
import { createPurchaseOrderSchema } from '../src/modules/purchases/purchase.schemas.js';
import { createSaleSchema } from '../src/modules/sales/sale.schemas.js';

const productId = '3f6c1c1e-8a2b-4c3d-9e4f-5a6b7c8d9e0f';

function order(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: '9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a',
    lines: [{ productId, quantity: 2, unitCost: 10 }],
    ...overrides,
  };
}

describe('schémas de saisie des commandes d’achat', () => {
  it('laisse la TVA de ligne indéfinie pour qu’elle suive le produit', () => {
    const parsed = createPurchaseOrderSchema.parse(order());

    expect(parsed.lines[0].taxRate).toBeUndefined();
    expect(parsed.lines[0].discountPercent).toBe(0);
  });

  it('conserve une TVA explicite sur la ligne', () => {
    const parsed = createPurchaseOrderSchema.parse(
      order({ lines: [{ productId, quantity: 2, unitCost: 10, taxRate: 5.5 }] }),
    );

    expect(parsed.lines[0].taxRate).toBe(5.5);
  });

  it('aligne les règles de TVA et de remise sur celles des ventes', () => {
    const purchase = createPurchaseOrderSchema.safeParse(
      order({ lines: [{ productId, quantity: 2, unitCost: 10, taxRate: 101 }] }),
    );
    const sale = createSaleSchema.safeParse({
      customerId: null,
      lines: [{ productId, quantity: 2, unitPrice: 10, taxRate: 101 }],
    });

    expect(purchase.success).toBe(false);
    expect(sale.success).toBe(false);
  });

  it('refuse deux lignes pour le même produit', () => {
    const parsed = createPurchaseOrderSchema.safeParse(
      order({ lines: [{ productId, quantity: 1, unitCost: 5 }, { productId, quantity: 2, unitCost: 6 }] }),
    );

    expect(parsed.success).toBe(false);
  });
});
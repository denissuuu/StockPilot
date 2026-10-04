import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculatePurchaseLine, calculatePurchaseTotals, calculateSaleLine, calculateSaleTotals, money, quantity, sum } from '../src/lib/financial.js';

describe('calculs financiers centralisés', () => {
  it('calcule une ligne de vente, remises, taxes, coût et marge hors taxes', () => {
    const line = calculateSaleLine({
      quantity: 10,
      unitPrice: 12,
      unitCost: 5,
      discountPercent: 10,
      taxRate: 20,
    });

    expect(line.lineSubtotal.toString()).toBe('120');
    expect(line.discountAmount.toString()).toBe('12');
    expect(line.taxAmount.toString()).toBe('21.6');
    expect(line.lineTotal.toString()).toBe('129.6');
    expect(line.costTotal.toString()).toBe('50');
    expect(line.lineProfit.toString()).toBe('58');
  });

  it('agrège les totaux de plusieurs lignes et calcule la marge nette', () => {
    const lines = [
      calculateSaleLine({ quantity: 2, unitPrice: 10, unitCost: 4, taxRate: 20 }),
      calculateSaleLine({ quantity: 1, unitPrice: 25, unitCost: 10, discountPercent: 20, taxRate: 20 }),
    ];
    const totals = calculateSaleTotals(lines);

    expect(totals.subtotal.toString()).toBe('45');
    expect(totals.discountTotal.toString()).toBe('5');
    expect(totals.taxTotal.toString()).toBe('8');
    expect(totals.total.toString()).toBe('48');
    expect(totals.costTotal.toString()).toBe('18');
    expect(totals.grossProfit.toString()).toBe('22');
    expect(totals.marginPercent.toString()).toBe('55');
  });

  it('calcule les totaux d’une ligne fournisseur avec remise et taxe', () => {
    // Une ligne d’achat ne porte qu’un coût unitaire : aucun prix de vente n’est attendu.
    const line = calculatePurchaseLine({ quantity: 4, unitCost: 7.5, discountPercent: 10, taxRate: 20 });
    const totals = calculatePurchaseTotals([line]);

    expect(line.lineSubtotal.toString()).toBe('30');
    expect(line.taxAmount.toString()).toBe('5.4');
    expect(line.lineTotal.toString()).toBe('32.4');
    expect(totals.subtotal.toString()).toBe('30');
    expect(totals.total.toString()).toBe('32.4');
  });

  it('n’applique la remise qu’à la ligne d’achat, pas au total', () => {
    const lines = [
      calculatePurchaseLine({ quantity: 2, unitCost: 10 }),
      calculatePurchaseLine({ quantity: 1, unitCost: 30, discountPercent: 50 }),
    ];
    const totals = calculatePurchaseTotals(lines);

    expect(lines[0].lineSubtotal.toString()).toBe('20');
    expect(lines[1].lineSubtotal.toString()).toBe('30');
    expect(lines[1].lineTotal.toString()).toBe('15');
    expect(totals.subtotal.toString()).toBe('50');
    expect(totals.total.toString()).toBe('35');
  });

  it('gère les valeurs nulles et les arrondis monétaires', () => {
    expect(money(null)).toBe(0);
    expect(quantity('12.34567')).toBe(12.3457);
    expect(money('1.005')).toBe(1.01);
    expect(sum([new Prisma.Decimal('1.10'), '2.20', 3]).toString()).toBe('6.3');
  });
});

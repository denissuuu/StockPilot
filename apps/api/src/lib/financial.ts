import { Prisma } from '@prisma/client';

export type Numeric = Prisma.Decimal | number | string | null | undefined;

export interface FinancialLineInput {
  quantity: Numeric;
  unitPrice: Numeric;
  unitCost: Numeric;
  discountPercent?: Numeric;
  taxRate?: Numeric;
}

export interface FinancialLine {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  costTotal: Prisma.Decimal;
  lineProfit: Prisma.Decimal;
}

export interface FinancialTotals {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  costTotal: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
}

export function decimal(value: Numeric): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

export function money(value: Numeric): number {
  return decimal(value).toDecimalPlaces(2).toNumber();
}

export function quantity(value: Numeric): number {
  return decimal(value).toDecimalPlaces(4).toNumber();
}

export function percent(value: Numeric): number {
  return decimal(value).toDecimalPlaces(3).toNumber();
}

/** Calcule une ligne de vente. La marge est calculée hors taxes. */
export function calculateSaleLine(input: FinancialLineInput): FinancialLine {
  const qty = decimal(input.quantity);
  const price = decimal(input.unitPrice);
  const cost = decimal(input.unitCost);
  const discountRate = decimal(input.discountPercent ?? 0);
  const taxRate = decimal(input.taxRate ?? 0);

  const lineSubtotal = qty.mul(price);
  const discountAmount = lineSubtotal.mul(discountRate).div(100);
  const taxable = lineSubtotal.minus(discountAmount);
  const taxAmount = taxable.mul(taxRate).div(100);
  const lineTotal = taxable.plus(taxAmount);
  const costTotal = qty.mul(cost);
  const lineProfit = taxable.minus(costTotal);

  return {
    quantity: qty,
    unitPrice: price,
    unitCost: cost,
    discountPercent: discountRate,
    taxRate,
    lineSubtotal: lineSubtotal.toDecimalPlaces(2),
    discountAmount: discountAmount.toDecimalPlaces(2),
    taxAmount: taxAmount.toDecimalPlaces(2),
    lineTotal: lineTotal.toDecimalPlaces(2),
    costTotal: costTotal.toDecimalPlaces(2),
    lineProfit: lineProfit.toDecimalPlaces(2),
  };
}

export function calculateSaleTotals(lines: FinancialLine[]): FinancialTotals {
  const subtotal = sum(lines.map((line) => line.lineSubtotal));
  const discountTotal = sum(lines.map((line) => line.discountAmount));
  const taxTotal = sum(lines.map((line) => line.taxAmount));
  const total = sum(lines.map((line) => line.lineTotal));
  const costTotal = sum(lines.map((line) => line.costTotal));
  const grossProfit = total.minus(taxTotal).minus(costTotal);
  const netRevenue = total.minus(taxTotal);
  const marginPercent = netRevenue.isZero() ? new Prisma.Decimal(0) : grossProfit.div(netRevenue).mul(100);

  return {
    subtotal: subtotal.toDecimalPlaces(2),
    discountTotal: discountTotal.toDecimalPlaces(2),
    taxTotal: taxTotal.toDecimalPlaces(2),
    total: total.toDecimalPlaces(2),
    costTotal: costTotal.toDecimalPlaces(2),
    grossProfit: grossTotal(grossProfit),
    marginPercent: marginPercent.toDecimalPlaces(3),
  };
}

export interface PurchaseLineTotals {
  lineSubtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export function calculatePurchaseLine(input: FinancialLineInput): PurchaseLineTotals {
  const qty = decimal(input.quantity);
  const unitCost = decimal(input.unitPrice);
  const discountRate = decimal(input.discountPercent ?? 0);
  const taxRate = decimal(input.taxRate ?? 0);
  const lineSubtotal = qty.mul(unitCost);
  const taxable = lineSubtotal.mul(new Prisma.Decimal(1).minus(discountRate.div(100)));
  const taxAmount = taxable.mul(taxRate).div(100);

  return {
    lineSubtotal: lineSubtotal.toDecimalPlaces(2),
    taxAmount: taxAmount.toDecimalPlaces(2),
    lineTotal: taxable.plus(taxAmount).toDecimalPlaces(2),
  };
}

export function calculatePurchaseTotals(
  lines: Array<PurchaseLineTotals & { lineSubtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; lineTotal: Prisma.Decimal }>,
): { subtotal: Prisma.Decimal; taxTotal: Prisma.Decimal; total: Prisma.Decimal } {
  const subtotal = sum(lines.map((line) => line.lineSubtotal));
  const taxTotal = sum(lines.map((line) => line.taxAmount));
  const total = sum(lines.map((line) => line.lineTotal));
  return {
    subtotal: subtotal.toDecimalPlaces(2),
    taxTotal: taxTotal.toDecimalPlaces(2),
    total: total.toDecimalPlaces(2),
  };
}

export function sum(values: Numeric[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, value) => acc.plus(decimal(value)), new Prisma.Decimal(0));
}

function grossTotal(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

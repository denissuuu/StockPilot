import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { dateKey } from '../../lib/dates.js';
import { money, percent, quantity as numericQuantity, sum } from '../../lib/financial.js';
import { boundedDateRange } from '../../lib/query.js';
import { getCurrentStocks } from '../catalog/stock.service.js';
import type { DashboardInput } from './dashboard.schemas.js';

export async function getDashboard(organizationId: string, input: DashboardInput) {
  const { from, to } = boundedDateRange(input);
  const [sales, purchaseOrders, products, saleLines] = await Promise.all([
    prisma.sale.findMany({ where: { organizationId, status: 'COMPLETED', soldAt: { gte: from, lte: to } }, select: { id: true, soldAt: true, total: true, taxTotal: true, costTotal: true, grossProfit: true } }),
    prisma.purchaseOrder.findMany({ where: { organizationId, status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] } }, select: { id: true, total: true, status: true } }),
    prisma.product.findMany({ where: { organizationId, isActive: true }, select: { id: true, sku: true, name: true, costPrice: true, minStock: true } }),
    prisma.saleLine.findMany({ where: { sale: { organizationId, status: 'COMPLETED', soldAt: { gte: from, lte: to } } }, select: { productId: true, productSku: true, productName: true, quantity: true, lineTotal: true, taxAmount: true, lineProfit: true } }),
  ]);
  const stocks = await getCurrentStocks(prisma, organizationId, products.map((product) => product.id));

  const revenueTaxIncluded = sum(sales.map((sale) => sale.total));
  const taxTotal = sum(sales.map((sale) => sale.taxTotal));
  const revenue = revenueTaxIncluded.minus(taxTotal);
  const costTotal = sum(sales.map((sale) => sale.costTotal));
  const grossProfit = sum(sales.map((sale) => sale.grossProfit));
  const margin = revenue.isZero() ? new Prisma.Decimal(0) : grossProfit.div(revenue).mul(100);
  const stockValue = products.reduce((acc, product) => acc.plus((stocks.get(product.id) ?? new Prisma.Decimal(0)).mul(product.costPrice)), new Prisma.Decimal(0));
  const stockUnits = products.reduce((acc, product) => acc.plus(stocks.get(product.id) ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
  const lowStockProducts = products.filter((product) => product.minStock.gt(0) && (stocks.get(product.id) ?? new Prisma.Decimal(0)).lte(product.minStock));

  const topMap = new Map<string, { productId: string; sku: string; name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal; profit: Prisma.Decimal }>();
  for (const line of saleLines) {
    const current = topMap.get(line.productId) ?? { productId: line.productId, sku: line.productSku, name: line.productName, quantity: new Prisma.Decimal(0), revenue: new Prisma.Decimal(0), profit: new Prisma.Decimal(0) };
    current.quantity = current.quantity.plus(line.quantity);
    current.revenue = current.revenue.plus(line.lineTotal.minus(line.taxAmount));
    current.profit = current.profit.plus(line.lineProfit);
    topMap.set(line.productId, current);
  }
  const topProducts = [...topMap.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)).slice(0, 10).map((item) => ({
    productId: item.productId,
    sku: item.sku,
    name: item.name,
    quantity: numericQuantity(item.quantity),
    revenue: money(item.revenue),
    profit: money(item.profit),
  }));

  const seriesMap = new Map<string, { revenue: Prisma.Decimal; tax: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal; count: number }>();
  for (const sale of sales) {
    const key = seriesKey(sale.soldAt, input.granularity);
    const current = seriesMap.get(key) ?? { revenue: new Prisma.Decimal(0), tax: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), profit: new Prisma.Decimal(0), count: 0 };
    current.revenue = current.revenue.plus(sale.total.minus(sale.taxTotal));
    current.tax = current.tax.plus(sale.taxTotal);
    current.cost = current.cost.plus(sale.costTotal);
    current.profit = current.profit.plus(sale.grossProfit);
    current.count += 1;
    seriesMap.set(key, current);
  }
  const series = buildSeries(from, to, input.granularity, seriesMap);

  return {
    period: { from: from.toISOString(), to: to.toISOString(), granularity: input.granularity },
    kpis: {
      salesCount: sales.length,
      revenueTaxIncluded: money(revenueTaxIncluded),
      taxTotal: money(taxTotal),
      revenue: money(revenue),
      costTotal: money(costTotal),
      grossProfit: money(grossProfit),
      marginPercent: percent(margin),
      averageBasket: sales.length ? money(revenue.div(sales.length)) : 0,
      stockValue: money(stockValue),
      stockUnits: numericQuantity(stockUnits),
      lowStockProducts: lowStockProducts.length,
      openPurchaseOrders: purchaseOrders.length,
      openPurchaseAmount: money(sum(purchaseOrders.map((order) => order.total))),
    },
    series,
    topProducts,
  };
}

function seriesKey(date: Date, granularity: DashboardInput['granularity']): string {
  if (granularity === 'month') return date.toISOString().slice(0, 7);
  if (granularity === 'week') {
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    return dateKey(monday);
  }
  return dateKey(date);
}

function buildSeries(
  from: Date,
  to: Date,
  granularity: DashboardInput['granularity'],
  values: Map<string, { revenue: Prisma.Decimal; tax: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal; count: number }>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  const cursor = new Date(from);
  if (granularity === 'month') cursor.setUTCDate(1);
  if (granularity === 'week') {
    const day = cursor.getUTCDay();
    cursor.setUTCDate(cursor.getUTCDate() + (day === 0 ? -6 : 1 - day));
  }
  while (cursor <= to) {
    const key = seriesKey(cursor, granularity);
    if (!result.some((item) => item.key === key)) {
      const value = values.get(key) ?? { revenue: new Prisma.Decimal(0), tax: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), profit: new Prisma.Decimal(0), count: 0 };
      result.push({
        key,
        revenue: money(value.revenue),
        tax: money(value.tax),
        cost: money(value.cost),
        grossProfit: money(value.profit),
        marginPercent: value.revenue.isZero() ? 0 : percent(value.profit.div(value.revenue).mul(100)),
        salesCount: value.count,
      });
    }
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else if (granularity === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

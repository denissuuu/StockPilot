import { prisma } from '../../lib/prisma.js';
import { toCsv } from '../../lib/csv.js';
import { money, quantity as numericQuantity, percent } from '../../lib/financial.js';
import { getCurrentStocks } from '../catalog/stock.service.js';

export type ExportType = 'products' | 'sales' | 'stock-movements';

export async function buildCsvExport(organizationId: string, type: ExportType, search?: string): Promise<{ filename: string; content: string }> {
  if (type === 'products') return exportProducts(organizationId, search);
  if (type === 'sales') return exportSales(organizationId, search);
  return exportMovements(organizationId, search);
}

async function exportProducts(organizationId: string, search?: string) {
  const products = await prisma.product.findMany({
    where: { organizationId, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }] } : {}) },
    orderBy: { name: 'asc' },
  });
  const stocks = await getCurrentStocks(prisma, organizationId, products.map((product) => product.id));
  const content = toCsv(
    ['SKU', 'Nom', 'Code-barres', 'Catégorie', 'Unité', 'Coût', 'Prix de vente', 'TVA (%)', 'Stock', 'Seuil minimum', 'Actif'],
    products.map((product) => [product.sku, product.name, product.barcode, product.categoryId ?? '', product.unit, money(product.costPrice), money(product.salePrice), percent(product.taxRate), numericQuantity(stocks.get(product.id) ?? 0), numericQuantity(product.minStock), product.isActive ? 'oui' : 'non']),
  );
  return { filename: 'produits.csv', content };
}

async function exportSales(organizationId: string, search?: string) {
  const sales = await prisma.sale.findMany({
    where: { organizationId, ...(search ? { OR: [{ reference: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }] } : {}) },
    orderBy: { soldAt: 'desc' },
    include: { customer: { select: { name: true } } },
  });
  const content = toCsv(
    ['ID', 'Référence', 'Date', 'Client', 'Statut', 'Sous-total', 'Remises', 'TVA', 'Total', 'Coût', 'Marge brute', 'Marge (%)'],
    sales.map((sale) => [sale.id, sale.reference, sale.soldAt.toISOString(), sale.customer?.name ?? '', sale.status, money(sale.subtotal), money(sale.discountTotal), money(sale.taxTotal), money(sale.total), money(sale.costTotal), money(sale.grossProfit), percent(sale.marginPercent)]),
  );
  return { filename: 'ventes.csv', content };
}

async function exportMovements(organizationId: string, search?: string) {
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId, ...(search ? { OR: [{ note: { contains: search, mode: 'insensitive' } }, { product: { name: { contains: search, mode: 'insensitive' } } }, { product: { sku: { contains: search, mode: 'insensitive' } } }] } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { sku: true, name: true } }, createdBy: { select: { firstName: true, lastName: true } } },
  });
  const content = toCsv(
    ['Date', 'Produit SKU', 'Produit', 'Type', 'Quantité', 'Coût unitaire', 'Valeur', 'Référence', 'Motif', 'Utilisateur'],
    movements.map((movement) => [movement.createdAt.toISOString(), movement.product.sku, movement.product.name, movement.type, numericQuantity(movement.quantity), movement.unitCost === null ? '' : money(movement.unitCost), movement.totalValue === null ? '' : money(movement.totalValue), movement.referenceId ?? '', movement.reason ?? '', movement.createdBy ? `${movement.createdBy.firstName} ${movement.createdBy.lastName}` : '']),
  );
  return { filename: 'mouvements-stock.csv', content };
}

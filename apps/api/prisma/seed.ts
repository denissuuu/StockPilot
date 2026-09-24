import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  let organization = await prisma.organization.findFirst({ where: { name: 'StockPilot Démo' } });
  organization ??= await prisma.organization.create({
    data: { name: 'StockPilot Démo', legalName: 'StockPilot Démo SAS', currency: 'EUR', timezone: 'Europe/Paris' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stockpilot.local' },
    update: { passwordHash, firstName: 'Admin', lastName: 'StockPilot', role: 'ADMIN', organizationId: organization.id, isActive: true },
    create: { organizationId: organization.id, email: 'admin@stockpilot.local', passwordHash, firstName: 'Admin', lastName: 'StockPilot', role: 'ADMIN' },
  });

  const demoUsers = [
    { email: 'manager@stockpilot.local', firstName: 'Claire', lastName: 'Gestion', role: 'MANAGER' as const },
    { email: 'employe@stockpilot.local', firstName: 'Hugo', lastName: 'Vente', role: 'EMPLOYEE' as const },
    { email: 'viewer@stockpilot.local', firstName: 'Lecture', lastName: 'Seule', role: 'VIEWER' as const },
  ];
  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { organizationId: organization.id, firstName: user.firstName, lastName: user.lastName, role: user.role, isActive: true },
      create: { ...user, organizationId: organization.id, passwordHash },
    });
  }

  const categoryNames = ['Boissons', 'Snacks', 'Entrepôt'];
  const categories = new Map<string, string>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({ where: { organizationId_name: { organizationId: organization.id, name } }, update: {}, create: { organizationId: organization.id, name } });
    categories.set(name, category.id);
  }

  const productData = [
    { sku: 'BOIS-EAU-50', name: 'Eau minérale 50 cl', barcode: '340000000001', category: 'Boissons', unit: 'bouteille', costPrice: 0.35, salePrice: 1.2, taxRate: 5.5, minStock: 24, initialStock: 120 },
    { sku: 'BOIS-COLA-33', name: 'Cola 33 cl', barcode: '340000000002', category: 'Boissons', unit: 'canette', costPrice: 0.8, salePrice: 1.8, taxRate: 5.5, minStock: 18, initialStock: 80 },
    { sku: 'SNACK-BARRE', name: 'Barre céréalière', barcode: '340000000003', category: 'Snacks', unit: 'barre', costPrice: 0.9, salePrice: 2.5, taxRate: 20, minStock: 12, initialStock: 40 },
    { sku: 'ENT-CARTON', name: 'Cartonshipping', barcode: '340000000004', category: 'Entrepôt', unit: 'carton', costPrice: 1.1, salePrice: 0, taxRate: 20, minStock: 10, initialStock: 25 },
  ];
  const products = new Map<string, { id: string; sku: string; name: string; costPrice: Prisma.Decimal; salePrice: Prisma.Decimal; taxRate: Prisma.Decimal }>();
  for (const data of productData) {
    const product = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku: data.sku } },
      update: { name: data.name, barcode: data.barcode, costPrice: data.costPrice, salePrice: data.salePrice, taxRate: data.taxRate, minStock: data.minStock, categoryId: categories.get(data.category), isActive: true },
      create: { organizationId: organization.id, categoryId: categories.get(data.category), sku: data.sku, name: data.name, barcode: data.barcode, unit: data.unit, costPrice: data.costPrice, salePrice: data.salePrice, taxRate: data.taxRate, minStock: data.minStock, maxStock: 500 },
    });
    products.set(data.sku, product);
    const movement = await prisma.stockMovement.findFirst({ where: { organizationId: organization.id, productId: product.id, type: 'INITIAL' } });
    if (!movement) {
      await prisma.stockMovement.create({ data: { organizationId: organization.id, productId: product.id, type: 'INITIAL', quantity: data.initialStock, unitCost: product.costPrice, totalValue: new Prisma.Decimal(data.initialStock).mul(product.costPrice), note: 'Stock initial de démonstration', createdById: admin.id } });
    }
  }

  const existingSupplier = await prisma.supplier.findFirst({ where: { organizationId: organization.id, name: 'Grossiste Démo' } });
  const supplier = existingSupplier ?? await prisma.supplier.create({ data: { organizationId: organization.id, name: 'Grossiste Démo', email: 'commandes@grossiste-demo.local', phone: '+33100000001' } });
  const existingCustomer = await prisma.customer.findFirst({ where: { organizationId: organization.id, name: 'Client Démo' } });
  const customer = existingCustomer ?? await prisma.customer.create({ data: { organizationId: organization.id, name: 'Client Démo', email: 'client@demo.local', phone: '+33100000002' } });

  const existingOrder = await prisma.purchaseOrder.findFirst({ where: { organizationId: organization.id, reference: 'DEMO-PO-001' } });
  if (!existingOrder) {
    const first = products.get('BOIS-EAU-50')!;
    const subtotal = new Prisma.Decimal(48).mul(first.costPrice).toDecimalPlaces(2);
    const taxAmount = subtotal.mul(first.taxRate).div(100).toDecimalPlaces(2);
    await prisma.purchaseOrder.create({ data: { organizationId: organization.id, supplierId: supplier.id, reference: 'DEMO-PO-001', status: 'ORDERED', orderedAt: new Date(), subtotal, taxTotal: taxAmount, total: subtotal.plus(taxAmount), createdById: admin.id, lines: { create: { productId: first.id, quantity: 48, unitCost: first.costPrice, taxRate: first.taxRate, lineSubtotal: subtotal, taxAmount, lineTotal: subtotal.plus(taxAmount) } } } });
  }

  const existingSale = await prisma.sale.findFirst({ where: { organizationId: organization.id, reference: 'DEMO-SALE-001' } });
  if (!existingSale) {
    const product = products.get('BOIS-COLA-33')!;
    const quantity = new Prisma.Decimal(2);
    const subtotal = quantity.mul(product.salePrice).toDecimalPlaces(2);
    const tax = subtotal.mul(product.taxRate).div(100).toDecimalPlaces(2);
    const total = subtotal.plus(tax);
    const cost = quantity.mul(product.costPrice).toDecimalPlaces(2);
    const sale = await prisma.sale.create({ data: { organizationId: organization.id, customerId: customer.id, reference: 'DEMO-SALE-001', subtotal, discountTotal: 0, taxTotal: tax, total, costTotal: cost, grossProfit: subtotal.minus(cost), marginPercent: subtotal.minus(cost).div(subtotal).mul(100).toDecimalPlaces(3), createdById: admin.id, lines: { create: { productId: product.id, productSku: product.sku, productName: product.name, quantity, unitPrice: product.salePrice, unitCost: product.costPrice, taxRate: product.taxRate, lineSubtotal: subtotal, taxAmount: tax, lineTotal: total, costTotal: cost, lineProfit: subtotal.minus(cost) } } } });
    await prisma.stockMovement.create({ data: { organizationId: organization.id, productId: product.id, type: 'SALE', quantity: quantity.neg(), referenceType: 'SALE', referenceId: sale.id, unitCost: product.costPrice, totalValue: cost, createdById: admin.id, note: 'Vente de démonstration' } });
  }

  console.log('Seed terminé');
  console.log('Admin: admin@stockpilot.local / Admin123!');
  console.log('Manager: manager@stockpilot.local / Admin123!');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });

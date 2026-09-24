import { Prisma } from '@prisma/client';
import { isoDateRequired, isoDate } from './dates.js';
import { money, percent, quantity as numericQuantity } from './financial.js';

export function numberValue(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return new Prisma.Decimal(value).toNumber();
}

export function serializeUser(user: any): Record<string, unknown> {
  return {
    id: user.id,
    organizationId: user.organizationId,
    companyId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: isoDate(user.lastLoginAt),
    createdAt: isoDateRequired(user.createdAt),
    updatedAt: isoDate(user.updatedAt),
    organization: user.organization,
  };
}

export function serializeCategory(category: any): Record<string, unknown> {
  return {
    id: category.id,
    organizationId: category.organizationId,
    companyId: category.organizationId,
    name: category.name,
    description: category.description,
    parentId: category.parentId,
    createdAt: isoDateRequired(category.createdAt),
    updatedAt: isoDateRequired(category.updatedAt),
    ...(category.parent ? { parent: { id: category.parent.id, name: category.parent.name } } : {}),
    ...(category._count?.products !== undefined ? { productCount: category._count.products } : {}),
  };
}

export function serializeProduct(product: any, stock?: Prisma.Decimal | number | string | null): Record<string, unknown> {
  return {
    id: product.id,
    organizationId: product.organizationId,
    companyId: product.organizationId,
    categoryId: product.categoryId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    barcode: product.barcode,
    unit: product.unit,
    costPrice: money(product.costPrice),
    salePrice: money(product.salePrice),
    taxRate: percent(product.taxRate),
    minStock: numericQuantity(product.minStock),
    maxStock: product.maxStock === null || product.maxStock === undefined ? null : numericQuantity(product.maxStock),
    isActive: product.isActive,
    stock: stock === undefined ? undefined : numericQuantity(stock),
    createdAt: isoDateRequired(product.createdAt),
    updatedAt: isoDateRequired(product.updatedAt),
    ...(product.category ? { category: { id: product.category.id, name: product.category.name } } : {}),
  };
}

export function serializeSupplier(supplier: any): Record<string, unknown> {
  return {
    id: supplier.id,
    organizationId: supplier.organizationId,
    companyId: supplier.organizationId,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    taxId: supplier.taxId,
    isActive: supplier.isActive,
    createdAt: isoDateRequired(supplier.createdAt),
    updatedAt: isoDateRequired(supplier.updatedAt),
    ...(supplier._count ? { purchaseOrderCount: supplier._count.purchaseOrders } : {}),
  };
}

export function serializeCustomer(customer: any): Record<string, unknown> {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    companyId: customer.organizationId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    taxId: customer.taxId,
    isActive: customer.isActive,
    createdAt: isoDateRequired(customer.createdAt),
    updatedAt: isoDateRequired(customer.updatedAt),
    ...(customer._count ? { saleCount: customer._count.sales } : {}),
  };
}

export function serializeMovement(movement: any): Record<string, unknown> {
  return {
    id: movement.id,
    organizationId: movement.organizationId,
    companyId: movement.organizationId,
    productId: movement.productId,
    type: movement.type,
    quantity: numericQuantity(movement.quantity),
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    reason: movement.reason,
    note: movement.note,
    unitCost: movement.unitCost === null ? null : money(movement.unitCost),
    totalValue: movement.totalValue === null ? null : money(movement.totalValue),
    createdById: movement.createdById,
    createdAt: isoDateRequired(movement.createdAt),
    product: movement.product ? { id: movement.product.id, sku: movement.product.sku, name: movement.product.name } : undefined,
    createdBy: movement.createdBy ? { id: movement.createdBy.id, firstName: movement.createdBy.firstName, lastName: movement.createdBy.lastName } : undefined,
  };
}

export function serializeAdjustment(adjustment: any): Record<string, unknown> {
  return {
    id: adjustment.id,
    organizationId: adjustment.organizationId,
    companyId: adjustment.organizationId,
    productId: adjustment.productId,
    quantity: numericQuantity(adjustment.quantity),
    reason: adjustment.reason,
    note: adjustment.note,
    movementId: adjustment.movementId,
    createdById: adjustment.createdById,
    createdAt: isoDateRequired(adjustment.createdAt),
    product: adjustment.product ? { id: adjustment.product.id, sku: adjustment.product.sku, name: adjustment.product.name } : undefined,
    createdBy: adjustment.createdBy ? { id: adjustment.createdBy.id, firstName: adjustment.createdBy.firstName, lastName: adjustment.createdBy.lastName } : undefined,
  };
}

export function serializePurchaseOrder(order: any): Record<string, unknown> {
  return {
    id: order.id,
    organizationId: order.organizationId,
    companyId: order.organizationId,
    supplierId: order.supplierId,
    reference: order.reference,
    status: order.status,
    orderedAt: isoDate(order.orderedAt),
    expectedAt: isoDate(order.expectedAt),
    receivedAt: isoDate(order.receivedAt),
    notes: order.notes,
    subtotal: money(order.subtotal),
    taxTotal: money(order.taxTotal),
    total: money(order.total),
    createdById: order.createdById,
    createdAt: isoDateRequired(order.createdAt),
    updatedAt: isoDateRequired(order.updatedAt),
    supplier: order.supplier ? { id: order.supplier.id, name: order.supplier.name, email: order.supplier.email } : undefined,
    createdBy: order.createdBy ? { id: order.createdBy.id, firstName: order.createdBy.firstName, lastName: order.createdBy.lastName } : undefined,
    lines: order.lines?.map(serializePurchaseOrderLine),
  };
}

export function serializePurchaseOrderLine(line: any): Record<string, unknown> {
  return {
    id: line.id,
    productId: line.productId,
    productSku: line.product.sku,
    productName: line.product.name,
    quantity: numericQuantity(line.quantity),
    receivedQuantity: numericQuantity(line.receivedQuantity),
    unitCost: money(line.unitCost),
    discountPercent: percent(line.discountPercent),
    taxRate: percent(line.taxRate),
    lineSubtotal: money(line.lineSubtotal),
    taxAmount: money(line.taxAmount),
    lineTotal: money(line.lineTotal),
  };
}

export function serializeSale(sale: any): Record<string, unknown> {
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    companyId: sale.organizationId,
    customerId: sale.customerId,
    reference: sale.reference,
    status: sale.status,
    soldAt: isoDateRequired(sale.soldAt),
    subtotal: money(sale.subtotal),
    discountTotal: money(sale.discountTotal),
    taxTotal: money(sale.taxTotal),
    total: money(sale.total),
    costTotal: money(sale.costTotal),
    grossProfit: money(sale.grossProfit),
    marginPercent: percent(sale.marginPercent),
    notes: sale.notes,
    createdById: sale.createdById,
    createdAt: isoDateRequired(sale.createdAt),
    updatedAt: isoDateRequired(sale.updatedAt),
    customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name, email: sale.customer.email } : undefined,
    createdBy: sale.createdBy ? { id: sale.createdBy.id, firstName: sale.createdBy.firstName, lastName: sale.createdBy.lastName } : undefined,
    lines: sale.lines?.map(serializeSaleLine),
  };
}

export function serializeSaleLine(line: any): Record<string, unknown> {
  return {
    id: line.id,
    productId: line.productId,
    productSku: line.productSku,
    productName: line.productName,
    quantity: numericQuantity(line.quantity),
    unitPrice: money(line.unitPrice),
    unitCost: money(line.unitCost),
    discountPercent: percent(line.discountPercent),
    taxRate: percent(line.taxRate),
    lineSubtotal: money(line.lineSubtotal),
    taxAmount: money(line.taxAmount),
    lineTotal: money(line.lineTotal),
    costTotal: money(line.costTotal),
    lineProfit: money(line.lineProfit),
  };
}

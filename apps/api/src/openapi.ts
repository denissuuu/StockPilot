const successResponse = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' },
    data: {},
  },
} as const;

const errorResponse = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
        requestId: { type: 'string' },
      },
    },
  },
} as const;

const commonResponses = {
  200: successResponse,
  201: successResponse,
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  422: errorResponse,
  429: errorResponse,
  500: errorResponse,
} as const;

export const openApiPublic = {
  security: [] as Array<Record<string, string[]>>,
  response: commonResponses,
} as const;

export const openApiProtected = {
  security: [{ bearerAuth: [] as string[] }],
  response: commonResponses,
} as const;

export const openApiIdParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export const openApiErrorResponse = errorResponse;

export const openApiPageQuery = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    search: { type: 'string', maxLength: 120 },
  },
} as const;

export const openApiSchemas = {
  Error: errorResponse,
  Success: successResponse,
  PageMeta: {
    type: 'object',
    required: ['page', 'pageSize', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  },
  User: {
    type: 'object',
    required: ['id', 'companyId', 'email', 'role'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      companyId: { type: 'string', format: 'uuid' },
      organizationId: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'] },
      isActive: { type: 'boolean' },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Product: {
    type: 'object',
    required: ['id', 'companyId', 'sku', 'name', 'costPrice', 'salePrice', 'stock'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      companyId: { type: 'string', format: 'uuid' },
      sku: { type: 'string' },
      name: { type: 'string' },
      barcode: { type: 'string', nullable: true },
      costPrice: { type: 'number' },
      salePrice: { type: 'number' },
      taxRate: { type: 'number' },
      minStock: { type: 'number' },
      maxStock: { type: 'number', nullable: true },
      stock: { type: 'number' },
      isActive: { type: 'boolean' },
    },
  },
  StockMovement: {
    type: 'object',
    required: ['id', 'companyId', 'productId', 'type', 'quantity', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      companyId: { type: 'string', format: 'uuid' },
      productId: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['INITIAL', 'PURCHASE_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT'] },
      quantity: { type: 'number' },
      unitCost: { type: 'number', nullable: true },
      totalValue: { type: 'number', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Sale: {
    type: 'object',
    required: ['id', 'companyId', 'status', 'subtotal', 'taxTotal', 'total', 'grossProfit', 'marginPercent'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      companyId: { type: 'string', format: 'uuid' },
      customerId: { type: 'string', format: 'uuid', nullable: true },
      status: { type: 'string', enum: ['COMPLETED', 'CANCELLED'] },
      soldAt: { type: 'string', format: 'date-time' },
      subtotal: { type: 'number' },
      discountTotal: { type: 'number' },
      taxTotal: { type: 'number' },
      total: { type: 'number' },
      costTotal: { type: 'number' },
      grossProfit: { type: 'number' },
      marginPercent: { type: 'number' },
    },
  },
  PurchaseOrder: {
    type: 'object',
    required: ['id', 'companyId', 'supplierId', 'status', 'subtotal', 'taxTotal', 'total'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      companyId: { type: 'string', format: 'uuid' },
      supplierId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] },
      subtotal: { type: 'number' },
      taxTotal: { type: 'number' },
      total: { type: 'number' },
    },
  },
} as const;


export type ID = string;

export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE" | "VIEWER";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type MovementType = "INITIAL" | "PURCHASE_RECEIPT" | "SALE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "RETURN_IN" | "RETURN_OUT";
export type OrderStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type SaleStatus = "COMPLETED" | "CANCELLED";

export interface User {
  id: ID;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: ID;
  name: string;
  description?: string;
  parentId?: ID;
  productCount?: number;
  createdAt?: string;
}

export interface Product {
  id: ID;
  sku: string;
  name: string;
  description?: string;
  categoryId?: ID;
  category?: Category | null;
  purchasePrice?: number;
  salePrice?: number;
  taxRate?: number;
  stockQuantity?: number;
  minStock?: number;
  maxStock?: number | null;
  barcode?: string;
  unit?: string;
  status?: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: ID;
  productId: ID;
  product?: Pick<Product, "id" | "sku" | "name"> | null;
  type: MovementType;
  quantity: number;
  reason?: string;
  note?: string;
  referenceType?: string;
  referenceId?: string;
  user?: Pick<User, "id" | "fullName" | "email"> | null;
  createdAt: string;
}

export interface Supplier {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  status?: "ACTIVE" | "INACTIVE";
  productCount?: number;
  createdAt?: string;
}

export interface PurchaseOrderItem {
  id?: ID;
  productId: ID;
  product?: Pick<Product, "id" | "sku" | "name"> | null;
  quantity: number;
  receivedQuantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface PurchaseOrder {
  id: ID;
  reference?: string;
  supplierId?: ID;
  supplier?: Pick<Supplier, "id" | "name"> | null;
  status?: OrderStatus;
  totalAmount?: number;
  itemCount?: number;
  orderedAt?: string;
  expectedAt?: string;
  receivedAt?: string;
  items?: PurchaseOrderItem[];
  createdAt?: string;
}

export interface Customer {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  status?: "ACTIVE" | "INACTIVE";
  orderCount?: number;
  createdAt?: string;
}

export interface CustomerPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface SalesOrderItem {
  id?: ID;
  productId: ID;
  product?: Pick<Product, "id" | "sku" | "name"> | null;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface SalesOrder {
  id: ID;
  reference?: string;
  customerId?: ID;
  customer?: Pick<Customer, "id" | "name"> | null;
  status?: SaleStatus;
  totalAmount?: number;
  itemCount?: number;
  createdAt?: string;
  items?: SalesOrderItem[];
}

export interface DashboardKpi {
  revenue: number;
  revenueChange?: number;
  purchases: number;
  purchasesChange?: number;
  stockValue: number;
  stockValueChange?: number;
  grossMargin: number;
  grossMarginChange?: number;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  purchases?: number;
}

export interface CategoryMargin {
  name: string;
  margin: number;
  revenue?: number;
  color?: string;
}

export interface TopProduct {
  id?: ID;
  name: string;
  sku?: string;
  quantity: number;
  revenue?: number;
  margin?: number;
}

export interface StockAlert {
  id: ID;
  productId?: ID;
  productName: string;
  sku?: string;
  currentStock: number;
  minStock: number;
  severity?: "CRITICAL" | "WARNING" | "LOW" | string;
}

export interface DashboardSummary {
  kpis: DashboardKpi;
  revenueSeries: RevenuePoint[];
  categoryMargins: CategoryMargin[];
  topProducts: TopProduct[];
  stockAlerts: StockAlert[];
  generatedAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken?: string;
  refreshToken?: string;
  token?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ProductPayload {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity?: number;
  minStock?: number;
  unit?: string;
  status?: ProductStatus;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  color?: string;
}

export interface StockAdjustmentPayload {
  productId: string;
  quantity: number;
  reason: "DAMAGE" | "EXPIRY" | "THEFT" | "COUNT_CORRECTION" | "FOUND" | "OTHER";
  note?: string;
}

export interface PurchaseOrderPayload {
  supplierId: string;
  expectedAt?: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface ReceivePurchaseOrderPayload {
  items?: Array<{ productId: string; quantity: number }>;
  lines?: Array<{ lineId: string; quantity: number }>;
  receivedAt?: string;
}

export interface SalesOrderPayload {
  customerId?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}

export interface UserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password?: string;
  isActive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiErrorShape {
  message?: string;
  error?: string;
  statusCode?: number;
}

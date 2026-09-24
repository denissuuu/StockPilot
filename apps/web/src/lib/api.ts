import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  AuthResponse,
  Category,
  CategoryMargin,
  CategoryPayload,
  Customer,
  CustomerPayload,
  DashboardSummary,
  DashboardKpi,
  ID,
  LoginPayload,
  PaginatedResponse,
  Product,
  ProductPayload,
  PurchaseOrder,
  PurchaseOrderPayload,
  ReceivePurchaseOrderPayload,
  SalesOrder,
  SalesOrderPayload,
  StockMovement,
  StockAlert,
  StockAdjustmentPayload,
  Supplier,
  TopProduct,
  User,
  UserPayload,
} from "../types/api";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;
let sessionGeneration = 0;

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function firstValue(source: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function unwrapPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const keys = Object.keys(value);
  if ("data" in value && (value.success === true || keys.every((key) => key === "data" || key === "meta" || key === "pagination"))) {
    return value.data;
  }
  return value;
}

function unwrapRecord<T>(value: unknown): T {
  return unwrapPayload(value) as T;
}

function unwrapList<T>(value: unknown): T[] {
  const payload = unwrapPayload(value);
  if (Array.isArray(payload)) return payload as T[];

  const record = asRecord(payload);
  for (const key of ["items", "results", "records", "rows"]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  if (Array.isArray(record.data)) return record.data as T[];
  if (isRecord(record.data)) return unwrapList<T>(record.data);
  return [];
}

function normalizeKpis(value: unknown): DashboardKpi {
  const root = asRecord(unwrapPayload(value));
  const source = isRecord(root.kpis) ? root.kpis : root;
  return {
    revenue: asNumber(firstValue(source, ["revenue", "salesRevenue", "ca", "chiffreAffaires", "chiffre_affaires"])),
    revenueChange: asOptionalNumber(firstValue(source, ["revenueChange", "salesChange", "caChange"])),
    purchases: asNumber(firstValue(source, ["purchases", "openPurchaseAmount", "purchaseAmount", "achats"])),
    purchasesChange: asOptionalNumber(firstValue(source, ["purchasesChange", "purchaseChange"])),
    stockValue: asNumber(firstValue(source, ["stockValue", "inventoryValue", "valeurStock", "valeur_stock"])),
    stockValueChange: asOptionalNumber(firstValue(source, ["stockValueChange", "inventoryValueChange"])),
    grossMargin: asNumber(firstValue(source, ["grossMargin", "margin", "marge", "margeBrute", "marginPercent"])),
    grossMarginChange: asOptionalNumber(firstValue(source, ["grossMarginChange", "marginChange"])),
  };
}

function normalizeRevenueSeries(value: unknown): DashboardSummary["revenueSeries"] {
  const root = asRecord(unwrapPayload(value));
  const candidate = firstValue(root, ["revenueSeries", "revenue", "salesSeries", "evp", "evolutionVentes", "evolution", "series", "chart"]);
  return unwrapList<UnknownRecord>(candidate).map((point, index) => {
    const record = asRecord(point);
    return {
      label: asString(firstValue(record, ["label", "name", "key", "month", "date", "period"]), `P${index + 1}`),
      revenue: asNumber(firstValue(record, ["revenue", "value", "sales", "ca"])),
      purchases: asNumber(firstValue(record, ["purchases", "purchasesValue", "achats"])),
    };
  });
}

function normalizeCategoryMargins(value: unknown): CategoryMargin[] {
  const root = asRecord(unwrapPayload(value));
  const candidate = firstValue(root, ["categoryMargins", "marginsByCategory", "margesCategories", "margeParCategorie", "categories"]);
  return unwrapList<UnknownRecord>(candidate).map((item) => {
    const record = asRecord(item);
    return {
      name: asString(firstValue(record, ["name", "label", "category"]), "Sans catégorie"),
      margin: asNumber(firstValue(record, ["margin", "value", "rate"])),
      revenue: asNumber(firstValue(record, ["revenue", "sales", "ca"])),
      color: asString(firstValue(record, ["color", "colour"])),
    };
  });
}

function normalizeTopProducts(value: unknown): TopProduct[] {
  const root = asRecord(unwrapPayload(value));
  const candidate = firstValue(root, ["topProducts", "bestSellers", "topProduits", "produitsPopulaires", "products"]);
  return unwrapList<UnknownRecord>(candidate).map((item, index) => {
    const record = asRecord(item);
    return {
      id: asString(firstValue(record, ["id", "productId"]), String(index)),
      name: asString(firstValue(record, ["name", "productName", "label"]), "Produit inconnu"),
      sku: asString(firstValue(record, ["sku", "reference"])),
      quantity: asNumber(firstValue(record, ["quantity", "qty", "soldQuantity", "sales"])),
      revenue: asNumber(firstValue(record, ["revenue", "salesAmount", "total"])),
      margin: asNumber(firstValue(record, ["margin", "marginRate"])),
    };
  });
}

function normalizeStockAlerts(value: unknown): DashboardSummary["stockAlerts"] {
  const root = asRecord(unwrapPayload(value));
  const candidate = firstValue(root, ["stockAlerts", "alerts", "alertesStock", "alertes", "lowStockProducts", "lowStock"]);
  return unwrapList<UnknownRecord>(candidate).map((item, index) => {
    const record = asRecord(item);
    const product = asRecord(firstValue(record, ["product"]));
    const current = firstValue(record, ["currentStock", "stock", "quantity", "stockQuantity"]);
    const minimum = firstValue(record, ["minStock", "minimum", "threshold", "stockMin"]);
    return {
      id: asString(firstValue(record, ["id", "productId"]), String(index)),
      productId: asString(firstValue(record, ["productId"])) || asString(firstValue(product, ["id"])),
      productName:
        asString(firstValue(record, ["productName", "name", "product"])) ||
        asString(firstValue(product, ["name", "label"]), "Produit"),
      sku: asString(firstValue(record, ["sku", "reference"])) || asString(firstValue(product, ["sku"])),
      currentStock: asNumber(current),
      minStock: asNumber(minimum),
      severity: asString(firstValue(record, ["severity", "level"]), "LOW"),
    };
  });
}

function normalizeDashboard(value: unknown): DashboardSummary {
  const root = asRecord(unwrapPayload(value));
  return {
    kpis: normalizeKpis(value),
    revenueSeries: normalizeRevenueSeries(value),
    categoryMargins: normalizeCategoryMargins(value),
    topProducts: normalizeTopProducts(value),
    stockAlerts: normalizeStockAlerts(value),
    generatedAt: asString(firstValue(root, ["generatedAt", "updatedAt"])) || undefined,
  };
}

function extractToken(payload: unknown): string | null {
  const root = asRecord(unwrapPayload(payload));
  const nested = asRecord(root.data);
  const token = firstValue(root, ["accessToken", "access_token", "token"]) ?? firstValue(nested, ["accessToken", "access_token", "token"]);
  return typeof token === "string" && token.length > 0 ? token : null;
}

function extractUser(payload: unknown): User {
  const root = asRecord(unwrapPayload(payload));
  const nested = asRecord(root.data);
  const candidate = firstValue(root, ["user", "account"]) ?? firstValue(nested, ["user", "account"]);
  const user = asRecord(candidate ?? (Object.keys(nested).length > 0 ? nested : root));
  return {
    id: asString(firstValue(user, ["id", "_id"])),
    email: asString(firstValue(user, ["email"])),
    firstName: asString(firstValue(user, ["firstName", "first_name"])) || undefined,
    lastName: asString(firstValue(user, ["lastName", "last_name"])) || undefined,
    fullName: asString(firstValue(user, ["fullName", "full_name", "name"])) || undefined,
    role: asString(firstValue(user, ["role"]), "VIEWER") as User["role"],
    isActive: typeof user.isActive === "boolean" ? user.isActive : user.active === true ? true : undefined,
    createdAt: asString(firstValue(user, ["createdAt", "created_at"])) || undefined,
  };
}

function setAccessToken(token: string | null): void {
  accessToken = token;
}

function getAccessToken(): string | null {
  return accessToken;
}

function notifyUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("stockpilot:unauthorized"));
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshRequest) return refreshRequest;
  const generation = sessionGeneration;
  const request = axios
    .post<AuthResponse>(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
    .then((response) => {
      const token = extractToken(response.data);
      if (generation !== sessionGeneration) return null;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      if (generation === sessionGeneration) setAccessToken(null);
      return null;
    })
    .finally(() => {
      if (refreshRequest === request) refreshRequest = null;
    });
  refreshRequest = request;
  return request;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status !== 401) return Promise.reject(error);

    const config = error.config as RetryableConfig | undefined;
    const url = config?.url ?? "";
    const isAuthRequest = /\/auth\/(login|refresh|logout)/.test(url);
    if (isAuthRequest || config?._retry) {
      if (config?._retry) notifyUnauthorized();
      return Promise.reject(error);
    }

    if (!config) return Promise.reject(error);
    config._retry = true;
    const token = await refreshAccessToken();
    if (!token) {
      notifyUnauthorized();
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  },
);

export function clearAuthSession(): void {
  sessionGeneration += 1;
  setAccessToken(null);
  refreshRequest = null;
}

export function getApiErrorMessage(error: unknown, fallback = "Une erreur est survenue."): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (isRecord(payload)) {
      const errorPayload = asRecord(payload.error);
      const message = firstValue(payload, ["message", "detail"]) ?? firstValue(errorPayload, ["message", "error", "detail"]);
      if (typeof message === "string" && message.length > 0) return message;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  const result = asString(value);
  return result || undefined;
}

function normalizeProduct(value: unknown): Product {
  const record = asRecord(unwrapPayload(value));
  const category = asRecord(firstValue(record, ["category"]));
  const statusValue = firstValue(record, ["status"]);
  const isActive = record.isActive === undefined ? true : record.isActive === true || record.isActive === "true";
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    sku: asString(firstValue(record, ["sku", "reference"])),
    name: asString(firstValue(record, ["name", "label"])),
    description: optionalString(firstValue(record, ["description"])),
    categoryId: optionalString(firstValue(record, ["categoryId"])),
    category: Object.keys(category).length > 0 ? {
      id: asString(firstValue(category, ["id"])),
      name: asString(firstValue(category, ["name", "label"])),
    } : undefined,
    purchasePrice: asNumber(firstValue(record, ["purchasePrice", "costPrice", "cost_price"])),
    salePrice: asNumber(firstValue(record, ["salePrice", "sale_price", "price"])),
    stockQuantity: asNumber(firstValue(record, ["stockQuantity", "stock", "quantity", "currentStock"])),
    taxRate: asNumber(firstValue(record, ["taxRate"]), 20),
    minStock: asNumber(firstValue(record, ["minStock", "minimum", "stockMin"])),
    maxStock: asOptionalNumber(firstValue(record, ["maxStock"])) ?? null,
    barcode: optionalString(firstValue(record, ["barcode", "ean", "codeBarre"])),
    unit: asString(firstValue(record, ["unit"]), "pcs"),
    status: asString(statusValue, isActive ? "ACTIVE" : "INACTIVE") as Product["status"],
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
    updatedAt: optionalString(firstValue(record, ["updatedAt", "updated_at"])),
  };
}

function normalizeCategory(value: unknown): Category {
  const record = asRecord(unwrapPayload(value));
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    name: asString(firstValue(record, ["name", "label"])),
    description: optionalString(firstValue(record, ["description"])),
    productCount: asNumber(firstValue(record, ["productCount", "productsCount", "count"])),
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
  };
}

function normalizeSupplier(value: unknown): Supplier {
  const record = asRecord(unwrapPayload(value));
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    name: asString(firstValue(record, ["name", "label"])),
    email: optionalString(firstValue(record, ["email"])),
    phone: optionalString(firstValue(record, ["phone", "telephone"])),
    address: optionalString(firstValue(record, ["address"])),
    taxId: optionalString(firstValue(record, ["taxId", "vatNumber"])),
    status: asString(firstValue(record, ["status"]), record.isActive === false || record.isActive === "false" ? "INACTIVE" : "ACTIVE") as "ACTIVE" | "INACTIVE",
    productCount: asNumber(firstValue(record, ["productCount", "purchaseOrderCount", "count"])),
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
  };
}

function normalizeCustomer(value: unknown): Customer {
  const record = asRecord(unwrapPayload(value));
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    name: asString(firstValue(record, ["name", "label"])),
    email: optionalString(firstValue(record, ["email"])),
    phone: optionalString(firstValue(record, ["phone", "telephone"])),
    address: optionalString(firstValue(record, ["address"])),
    taxId: optionalString(firstValue(record, ["taxId", "vatNumber"])),
    status: asString(firstValue(record, ["status"]), record.isActive === false || record.isActive === "false" ? "INACTIVE" : "ACTIVE") as "ACTIVE" | "INACTIVE",
    orderCount: asNumber(firstValue(record, ["orderCount", "saleCount", "salesCount", "count"])),
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
  };
}

function normalizeMovement(value: unknown): StockMovement {
  const record = asRecord(unwrapPayload(value));
  const product = asRecord(firstValue(record, ["product"]));
  const createdBy = asRecord(firstValue(record, ["createdBy", "user"]));
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    productId: asString(firstValue(record, ["productId"])),
    product: Object.keys(product).length > 0 ? {
      id: asString(firstValue(product, ["id"])),
      sku: asString(firstValue(product, ["sku", "reference"])),
      name: asString(firstValue(product, ["name", "label"])),
    } : undefined,
    type: asString(firstValue(record, ["type", "movementType"]), "ADJUSTMENT_IN") as StockMovement["type"],
    quantity: asNumber(firstValue(record, ["quantity", "qty"])),
    reason: optionalString(firstValue(record, ["reason"])),
    note: optionalString(firstValue(record, ["note"])),
    referenceType: optionalString(firstValue(record, ["referenceType"])),
    referenceId: optionalString(firstValue(record, ["referenceId"])),
    user: Object.keys(createdBy).length > 0 ? {
      id: asString(firstValue(createdBy, ["id"])),
      fullName: `${asString(firstValue(createdBy, ["firstName"]))} ${asString(firstValue(createdBy, ["lastName"]))}`.trim() || asString(firstValue(createdBy, ["email"])),
      email: optionalString(firstValue(createdBy, ["email"])) ?? "",
    } : undefined,
    createdAt: asString(firstValue(record, ["createdAt", "created_at", "date"])),
  };
}

function normalizePurchaseOrder(value: unknown): PurchaseOrder {
  const record = asRecord(unwrapPayload(value));
  const supplier = asRecord(firstValue(record, ["supplier"]));
  const items = unwrapList<UnknownRecord>(firstValue(record, ["items", "lines"])).map((item) => {
    const line = asRecord(item);
    const product = asRecord(firstValue(line, ["product"]));
    return {
      id: optionalString(firstValue(line, ["id", "lineId"])),
      productId: asString(firstValue(line, ["productId"])),
      product: Object.keys(product).length > 0 ? {
        id: asString(firstValue(product, ["id"])),
        sku: asString(firstValue(product, ["sku", "reference"])),
        name: asString(firstValue(product, ["name", "label"])),
      } : {
        id: asString(firstValue(line, ["productId"])),
        sku: asString(firstValue(line, ["productSku", "sku"])),
        name: asString(firstValue(line, ["productName", "name"])),
      },
      quantity: asNumber(firstValue(line, ["quantity"])),
      receivedQuantity: asNumber(firstValue(line, ["receivedQuantity", "received"])),
      unitPrice: asNumber(firstValue(line, ["unitPrice", "unitCost"])),
      total: asNumber(firstValue(line, ["total", "lineTotal", "lineSubtotal"])),
    };
  });
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    reference: optionalString(firstValue(record, ["reference", "number"])),
    supplierId: optionalString(firstValue(record, ["supplierId"])),
    supplier: Object.keys(supplier).length > 0 ? { id: asString(firstValue(supplier, ["id"])), name: asString(firstValue(supplier, ["name"])) } : undefined,
    status: asString(firstValue(record, ["status"]), "DRAFT") as PurchaseOrder["status"],
    totalAmount: asNumber(firstValue(record, ["totalAmount", "total", "subtotal"])),
    itemCount: asNumber(firstValue(record, ["itemCount", "lineCount"])) || items.length,
    orderedAt: optionalString(firstValue(record, ["orderedAt", "createdAt", "created_at"])),
    expectedAt: optionalString(firstValue(record, ["expectedAt", "expected_at"])),
    receivedAt: optionalString(firstValue(record, ["receivedAt", "received_at"])),
    items,
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
  };
}

function normalizeSalesOrder(value: unknown): SalesOrder {
  const record = asRecord(unwrapPayload(value));
  const customer = asRecord(firstValue(record, ["customer"]));
  const items = unwrapList<UnknownRecord>(firstValue(record, ["items", "lines"])).map((item) => {
    const line = asRecord(item);
    return {
      id: optionalString(firstValue(line, ["id", "lineId"])),
      productId: asString(firstValue(line, ["productId"])),
      product: {
        id: asString(firstValue(line, ["productId"])),
        sku: asString(firstValue(line, ["productSku", "sku"])),
        name: asString(firstValue(line, ["productName", "name"])),
      },
      quantity: asNumber(firstValue(line, ["quantity"])),
      unitPrice: asNumber(firstValue(line, ["unitPrice", "unitCost"])),
      total: asNumber(firstValue(line, ["total", "lineTotal", "lineSubtotal"])),
    };
  });
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    reference: optionalString(firstValue(record, ["reference", "number"])),
    customerId: optionalString(firstValue(record, ["customerId"])),
    customer: Object.keys(customer).length > 0 ? { id: asString(firstValue(customer, ["id"])), name: asString(firstValue(customer, ["name"])) } : undefined,
    status: asString(firstValue(record, ["status"]), "COMPLETED") as SalesOrder["status"],
    totalAmount: asNumber(firstValue(record, ["totalAmount", "total", "subtotal"])),
    itemCount: asNumber(firstValue(record, ["itemCount", "lineCount"])) || items.length,
    createdAt: asString(firstValue(record, ["createdAt", "created_at", "soldAt", "sold_at"])),
    items,
  };
}

function normalizeUser(value: unknown): User {
  const record = asRecord(unwrapPayload(value));
  const firstName = asString(firstValue(record, ["firstName", "first_name"]));
  const lastName = asString(firstValue(record, ["lastName", "last_name"]));
  return {
    id: asString(firstValue(record, ["id", "_id"])),
    email: asString(firstValue(record, ["email"])),
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName: `${firstName} ${lastName}`.trim() || optionalString(firstValue(record, ["fullName", "name"])),
    role: asString(firstValue(record, ["role"]), "VIEWER") as User["role"],
    isActive: typeof record.isActive === "boolean" ? record.isActive : record.isActive === undefined ? undefined : record.isActive === "true",
    createdAt: optionalString(firstValue(record, ["createdAt", "created_at"])),
  };
}

function normalizeList<T>(value: unknown, normalizer: (item: unknown) => T): T[] {
  return unwrapList<unknown>(value).map(normalizer);
}

function pageMeta(value: unknown): { page: number; pageSize: number; totalPages: number } {
  const root = asRecord(value);
  const meta = asRecord(root.meta);
  return {
    page: asNumber(meta.page, 1),
    pageSize: asNumber(meta.pageSize, 20),
    totalPages: asNumber(meta.totalPages, 1),
  };
}

async function normalizedList<T>(path: string, normalizer: (item: unknown) => T, params?: Record<string, unknown>): Promise<T[]> {
  const first = await api.get(path, { params: { ...params, page: 1, pageSize: 100 } });
  const firstItems = normalizeList<T>(first.data, normalizer);
  const meta = pageMeta(first.data);
  if (meta.totalPages <= 1) return firstItems;

  const remaining = await Promise.all(
    Array.from({ length: Math.min(meta.totalPages - 1, 19) }, (_, index) => index + 2).map((page) =>
      api.get(path, { params: { ...params, page, pageSize: meta.pageSize } }).then((response) => normalizeList<T>(response.data, normalizer)),
    ),
  );
  return [...firstItems, ...remaining.flat()];
}

function create<T, P>(path: string, payload: P): Promise<T> {
  return api.post(path, payload).then((response: AxiosResponse<T>) => unwrapRecord<T>(response.data));
}

function update<T, P>(path: string, payload: P, id: ID): Promise<T> {
  return api.patch(`${path}/${id}`, payload).then((response: AxiosResponse<T>) => unwrapRecord<T>(response.data));
}

function remove(path: string, id: ID): Promise<void> {
  return api.delete(`${path}/${id}`).then(() => undefined);
}

function exportCsv(path: string, params?: Record<string, unknown>): Promise<Blob> {
  return api.get(path, { params, responseType: "blob" }).then((response) => response.data as Blob);
}

function toProductRequest<T extends Partial<ProductPayload>>(payload: T): T {
  const { stockQuantity: _stockQuantity, status, purchasePrice, ...basePayload } = payload;
  return {
    ...basePayload,
    ...(purchasePrice !== undefined ? { costPrice: purchasePrice } : {}),
    ...(status !== undefined ? { isActive: status === "ACTIVE" } : {}),
  } as T;
}

function optionalize<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "")) as T;
}

function toSupplierRequest<T extends Partial<Supplier>>(payload: T): T {
  const { status, ...basePayload } = payload;
  return optionalize({ ...basePayload, ...(status !== undefined ? { isActive: status === "ACTIVE" } : {}) } as T);
}

function toPurchaseRequest(payload: PurchaseOrderPayload): Record<string, unknown> {
  return optionalize({
    supplierId: payload.supplierId,
    expectedAt: payload.expectedAt,
    notes: payload.notes,
    lines: payload.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitPrice })),
  });
}

function toSalesRequest(payload: SalesOrderPayload): Record<string, unknown> {
  return optionalize({
    customerId: payload.customerId,
    notes: payload.notes,
    lines: payload.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })),
  });
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", payload).then((response) => {
      const token = extractToken(response.data);
      setAccessToken(token);
      return { user: extractUser(response.data), accessToken: token ?? undefined };
    }),
  me: () => api.get("/auth/me").then((response) => extractUser(response.data)),
  logout: () => api.post("/auth/logout").then(() => clearAuthSession()),
  refresh: () => refreshAccessToken().then((token) => token !== null),
};

export const dashboardApi = {
  summary: (params?: Record<string, unknown>) => api.get("/dashboard", { params }).then((response) => normalizeDashboard(response.data)),
};

export const productsApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/products", normalizeProduct, params),
  get: (id: ID) => api.get(`/products/${id}`).then((response) => normalizeProduct(response.data)),
  alerts: () => normalizedList<StockAlert>("/products/alerts", (value) => {
    const product = normalizeProduct(value);
    return {
      id: product.id,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity ?? 0,
      minStock: product.minStock ?? 0,
      severity: (product.stockQuantity ?? 0) <= 0 ? "CRITICAL" : "LOW",
    };
  }),
  create: async (payload: ProductPayload) => {
    const product = await create<Product, ProductPayload>("/products", toProductRequest(payload));
    if ((payload.stockQuantity ?? 0) > 0) {
      await api.post("/stock-movements/initial", {
        productId: product.id,
        quantity: payload.stockQuantity,
        unitCost: payload.purchasePrice,
        note: "Stock initial lors de la création du produit",
      });
    }
    return product;
  },
  update: (id: ID, payload: Partial<ProductPayload>) => update<Product, Partial<ProductPayload>>("/products", toProductRequest(payload), id),
  remove: (id: ID) => remove("/products", id),
  exportCsv: (params?: Record<string, unknown>) => exportCsv("/exports", { type: "products", search: params?.search }),
};

export const categoriesApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/categories", normalizeCategory, params),
  create: (payload: CategoryPayload) => create<Category, Record<string, unknown>>("/categories", { name: payload.name, description: payload.description }),
  update: (id: ID, payload: Partial<CategoryPayload>) => update<Category, Record<string, unknown>>("/categories", { name: payload.name, description: payload.description }, id),
  remove: (id: ID) => remove("/categories", id),
};

export const stockApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/stock-movements", normalizeMovement, params),
  adjust: (payload: StockAdjustmentPayload) => api.post("/stock-adjustments", payload).then(() => undefined),
  exportCsv: (params?: Record<string, unknown>) => exportCsv("/exports", { type: "stock-movements", search: params?.search }),
};

export const suppliersApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/suppliers", normalizeSupplier, params),
  create: (payload: Partial<Supplier>) => create<Supplier, Partial<Supplier>>("/suppliers", toSupplierRequest(payload)),
  update: (id: ID, payload: Partial<Supplier>) => update<Supplier, Partial<Supplier>>("/suppliers", toSupplierRequest(payload), id),
  remove: (id: ID) => remove("/suppliers", id),
};

export const purchaseOrdersApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/purchase-orders", normalizePurchaseOrder, params),
  get: (id: ID) => api.get(`/purchase-orders/${id}`).then((response) => normalizePurchaseOrder(response.data)),
  create: (payload: PurchaseOrderPayload) => create<PurchaseOrder, Record<string, unknown>>("/purchase-orders", toPurchaseRequest(payload)),
  order: (id: ID) => api.post(`/purchase-orders/${id}/order`).then((response) => normalizePurchaseOrder(response.data)),
  receive: (id: ID, payload: ReceivePurchaseOrderPayload) => api.post(`/purchase-orders/${id}/receive`, { lines: payload.lines, receivedAt: payload.receivedAt }).then((response) => normalizePurchaseOrder(response.data)),
  cancel: (id: ID) => api.post(`/purchase-orders/${id}/cancel`).then((response) => normalizePurchaseOrder(response.data)),
};

export const customersApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/customers", normalizeCustomer, params),
  create: (payload: CustomerPayload) => create<Customer, Record<string, unknown>>("/customers", { ...payload, isActive: payload.status !== "INACTIVE" }),
  update: (id: ID, payload: Partial<CustomerPayload>) => update<Customer, Record<string, unknown>>("/customers", { ...payload, isActive: payload.status !== undefined ? payload.status === "ACTIVE" : undefined }, id),
  remove: (id: ID) => remove("/customers", id),
};

export const salesOrdersApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/sales", normalizeSalesOrder, params),
  create: (payload: SalesOrderPayload) => create<SalesOrder, Record<string, unknown>>("/sales", toSalesRequest(payload)),
  cancel: (id: ID) => api.post(`/sales/${id}/cancel`).then((response) => normalizeSalesOrder(response.data)),
};

export const usersApi = {
  list: (params?: Record<string, unknown>) => normalizedList("/users", normalizeUser, params),
  create: (payload: UserPayload) => create<User, UserPayload>("/users", payload),
  update: (id: ID, payload: Partial<UserPayload>) => update<User, Record<string, unknown>>("/users", payload, id),
  remove: (id: ID) => remove("/users", id),
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function getPagination<T>(payload: PaginatedResponse<T>): T[] {
  return payload.data;
}

export { getAccessToken };

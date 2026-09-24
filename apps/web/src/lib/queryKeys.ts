export const queryKeys = {
  dashboard: ["dashboard"] as const,
  products: (params?: Record<string, unknown>) => ["products", params ?? {}] as const,
  stockAlerts: ["products", "alerts"] as const,
  categories: ["categories"] as const,
  movements: (params?: Record<string, unknown>) => ["stock", "movements", params ?? {}] as const,
  suppliers: ["suppliers"] as const,
  purchaseOrders: (params?: Record<string, unknown>) => ["purchase-orders", params ?? {}] as const,
  customers: ["customers"] as const,
  salesOrders: (params?: Record<string, unknown>) => ["sales-orders", params ?? {}] as const,
  users: ["users"] as const,
};

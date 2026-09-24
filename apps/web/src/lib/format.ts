const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(value: number | string | null | undefined): string {
  return currencyFormatter.format(toNumber(value));
}

export function formatNumber(value: number | string | null | undefined): string {
  return numberFormatter.format(toNumber(value));
}

export function formatCompactNumber(value: number | string | null | undefined): string {
  return compactFormatter.format(toNumber(value));
}

export function formatPercent(value: number | string | null | undefined, withSign = false): string {
  const number = toNumber(value);
  const sign = withSign && number > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(number)} %`;
}

export function formatLongDate(value: string | Date | null | undefined = new Date()): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatRelativeDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const formatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  return formatDate(date);
}

export function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function getDisplayName(user: { firstName?: string; lastName?: string; fullName?: string; email: string }): string {
  if (user.fullName?.trim()) return user.fullName;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  ORDERED: "Transmise",
  PARTIAL: "Partiel",
  PARTIALLY_RECEIVED: "Partiellement reçue",
  RECEIVED: "Reçu",
  COMPLETED: "Terminée",
  PAID: "Payé",
  SHIPPED: "Expédié",
  CANCELLED: "Annulé",
  DRAFT: "Brouillon",
  INITIAL: "Stock initial",
  PURCHASE_RECEIPT: "Réception",
  SALE: "Vente",
  ADJUSTMENT_IN: "Ajustement positif",
  ADJUSTMENT_OUT: "Ajustement négatif",
  RETURN_IN: "Retour client",
  RETURN_OUT: "Retour fournisseur",
  LOW: "Faible",
  WARNING: "À surveiller",
  CRITICAL: "Critique",
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return statusLabels[status.toUpperCase()] ?? status;
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function getStatusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "PAID":
    case "RECEIVED":
    case "CONFIRMED":
    case "ORDERED":
    case "IN":
      return "success";
    case "PENDING":
    case "PARTIAL":
    case "PARTIALLY_RECEIVED":
    case "WARNING":
    case "LOW":
    case "ADJUSTMENT":
      return "warning";
    case "CANCELLED":
    case "ARCHIVED":
    case "CRITICAL":
    case "OUT":
      return "danger";
    case "SHIPPED":
    case "COMPLETED":
    case "RECEPTION":
    case "SALE":
    case "DRAFT":
      return "info";
    default:
      return "neutral";
  }
}

export function isLowStock(stock: number | null | undefined, minimum: number | null | undefined): boolean {
  if (stock === null || stock === undefined || minimum === null || minimum === undefined) return false;
  return toNumber(minimum) > 0 && toNumber(stock) <= toNumber(minimum);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

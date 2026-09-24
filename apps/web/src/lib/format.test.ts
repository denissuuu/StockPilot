import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getInitials,
  getStatusLabel,
  isLowStock,
} from "./format";

describe("format helpers", () => {
  it("formate les montants en euros", () => {
    expect(formatCurrency(1250.5)).toBe("1 250,50 €");
    expect(formatCurrency("19,90")).toBe("19,90 €");
  });

  it("formate les nombres avec la convention française", () => {
    expect(formatNumber(1234.5)).toBe("1 234,5");
    expect(formatNumber(null)).toBe("0");
  });

  it("retourne une date lisible et gère les valeurs invalides", () => {
    expect(formatDate("2025-02-03T10:00:00Z")).toContain("2025");
    expect(formatDate("pas une date")).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("extrait des initiales et un statut métier", () => {
    expect(getInitials("Marie Dupont")).toBe("MD");
    expect(getStatusLabel("RECEIVED")).toBe("Reçu");
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

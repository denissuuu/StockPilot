export function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function isoDateRequired(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(value: Date): Date {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

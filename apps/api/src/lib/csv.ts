export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const formula = /^[=+@]/.test(text) || (/^-/.test(text) && !/^-?\d+(?:[.,]\d+)?$/.test(text));
  const safe = formula ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

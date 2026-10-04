/**
 * Convertit une valeur en date exploitable, ou null si elle n'en est pas une.
 * Une date invalide se reconnaît à un NaN sur son horodatage : la laisser passer
 * ferait échouer toISOString plus loin, au sérialiseur.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Convertit une date en chaîne ISO 8601 pour la sérialisation.
 * Renvoie null si la valeur est absente ou illisible, et ne lève jamais :
 * une date illisible doit rendre un champ vide, pas faire échouer la requête
 * entière avec un RangeError.
 */
export function isoDate(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date === null ? null : date.toISOString();
}

/**
 * Variante stricte pour un champ obligatoire : signale l'anomalie au lieu de
 * la déguiser en null, avec un message qui nomme la cause.
 */
export function isoDateRequired(value: Date | string): string {
  const date = toDate(value);
  if (date === null) throw new RangeError('Date invalide : la sérialisation ISO 8601 est impossible');
  return date.toISOString();
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
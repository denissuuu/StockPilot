import { describe, expect, it } from 'vitest';
import { dateKey, endOfDay, isoDate, isoDateRequired, startOfDay } from '../src/lib/dates.js';

describe('isoDate', () => {
  it('sérialise une date et une chaîne déjà formatée', () => {
    expect(isoDate(new Date('2026-01-15T09:30:00.000Z'))).toBe('2026-01-15T09:30:00.000Z');
    expect(isoDate('2026-01-15T09:30:00.000Z')).toBe('2026-01-15T09:30:00.000Z');
  });

  it('renvoie null pour une valeur absente plutôt que de lever', () => {
    expect(isoDate(null)).toBeNull();
    expect(isoDate(undefined)).toBeNull();
    expect(isoDate('')).toBeNull();
  });

  it('renvoie null pour une date illisible au lieu de faire échouer la requête', () => {
    // new Date('pas une date') donne un objet Date invalide : toISOString lèverait.
    expect(isoDate(new Date('pas une date'))).toBeNull();
    expect(isoDate('pas une date')).toBeNull();
  });

  it('ne confond pas l’époque Unix avec une valeur absente', () => {
    expect(isoDate(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('isoDateRequired', () => {
  it('sérialise une date valide', () => {
    expect(isoDateRequired(new Date('2026-01-15T09:30:00.000Z'))).toBe('2026-01-15T09:30:00.000Z');
  });

  it('signale une date illisible au lieu de renvoyer un champ vide', () => {
    expect(() => isoDateRequired(new Date('pas une date'))).toThrow(RangeError);
    expect(() => isoDateRequired('pas une date')).toThrow(/Date invalide/);
  });
});

describe('bornes de journée', () => {
  it('ouvre et ferme une journée UTC', () => {
    const instant = new Date('2026-03-14T15:09:26.535Z');

    expect(startOfDay(instant).toISOString()).toBe('2026-03-14T00:00:00.000Z');
    expect(endOfDay(instant).toISOString()).toBe('2026-03-14T23:59:59.999Z');
  });

  it('extrait la clé de journée en UTC', () => {
    expect(dateKey(new Date('2026-03-14T23:59:59.999Z'))).toBe('2026-03-14');
  });
});
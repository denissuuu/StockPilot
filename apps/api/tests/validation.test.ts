import { describe, expect, it } from 'vitest';
import { decimalPlaces } from '../src/lib/validation.js';

describe('decimalPlaces', () => {
  it('accepte les valeurs compatibles avec PostgreSQL', () => {
    expect(decimalPlaces(12.1234, 4)).toBe(true);
    expect(decimalPlaces(0, 4)).toBe(true);
  });

  it('refuse un arrondi silencieux', () => {
    expect(decimalPlaces(0.00001, 4)).toBe(false);
  });
});

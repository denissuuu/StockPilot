import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from '../src/lib/csv.js';

describe('csvEscape', () => {
  it('quote les séparateurs et guillemets', () => {
    expect(csvEscape('Nom,')).toBe('"Nom,"');
    expect(csvEscape('Une "citation"')).toBe('"Une ""citation"""');
  });

  it('neutralise les formules Injectées dans un tableur', () => {
    expect(csvEscape('=HYPERLINK("https://example.test")')).toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(csvEscape('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
  });

  it('conserve les nombres négatifs', () => {
    expect(csvEscape(-12.5)).toBe('-12.5');
  });

  it('génère un fichier avec en-tête', () => {
    expect(toCsv(['sku', 'nom'], [['A-1', 'Clavier']])).toBe('sku,nom\nA-1,Clavier\n');
  });
});

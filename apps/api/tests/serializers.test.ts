import { describe, expect, it } from 'vitest';
import { serializeUser } from '../src/lib/serializers.js';

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  email: 'contact@exemple.fr',
  firstName: 'Camille',
  lastName: 'Durand',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date('2026-01-15T09:30:00.000Z'),
};

const organization = { id: base.organizationId, name: 'Boulangerie', currency: 'EUR', timezone: 'Europe/Paris' };

describe('sérialiseur d’utilisateur', () => {
  it('publie un profil unique, quel que soit le point d’entrée', () => {
    const serialized = serializeUser({ ...base, lastLoginAt: new Date('2026-02-01T18:00:00.000Z'), updatedAt: new Date('2026-02-01T18:00:00.000Z'), organization });

    expect(serialized).toEqual({
      id: base.id,
      organizationId: base.organizationId,
      companyId: base.organizationId,
      email: base.email,
      firstName: base.firstName,
      lastName: base.lastName,
      role: 'ADMIN',
      isActive: true,
      lastLoginAt: '2026-02-01T18:00:00.000Z',
      createdAt: '2026-01-15T09:30:00.000Z',
      updatedAt: '2026-02-01T18:00:00.000Z',
      organization,
    });
  });

  it('aligne companyId sur organizationId pour les anciens clients', () => {
    const serialized = serializeUser(base);

    expect(serialized.companyId).toBe(base.organizationId);
    expect(serialized.organizationId).toBe(base.organizationId);
  });

  it('renvoie null et non undefined pour une date jamais renseignée', () => {
    const serialized = serializeUser(base);

    // undefined disparaîtrait du JSON, ce qui ferait diverger la forme du corps.
    expect('lastLoginAt' in serialized).toBe(true);
    expect('updatedAt' in serialized).toBe(true);
    expect(serialized.lastLoginAt).toBeNull();
    expect(serialized.updatedAt).toBeNull();
  });

  it('n’invente pas isActive quand la source ne le fournit pas', () => {
    const source: Parameters<typeof serializeUser>[0] = {
      id: base.id,
      organizationId: base.organizationId,
      email: base.email,
      firstName: base.firstName,
      lastName: base.lastName,
      role: base.role,
      createdAt: base.createdAt,
    };

    expect(serializeUser(source).isActive).toBeUndefined();
  });

  it('accepte une date déjà sérialisée', () => {
    expect(serializeUser({ ...base, updatedAt: '2026-03-04T05:06:07.000Z' }).updatedAt).toBe('2026-03-04T05:06:07.000Z');
  });
});
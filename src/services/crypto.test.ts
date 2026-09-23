import { describe, expect, it } from 'vitest';
import { genererCodeSuivi, sha256, sha256Sync, uid } from '@/services/crypto';

describe('uid', () => {
  it('génère des identifiants distincts', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

describe('sha256 / sha256Sync', () => {
  it('produisent la même empreinte pour un même texte', async () => {
    const texte = 'ARR-2026-000001|Facture Bureautique Plus';
    expect(await sha256(texte)).toBe(sha256Sync(texte));
  });

  it('produit une empreinte hex de 64 caractères', async () => {
    const empreinte = await sha256('quelque chose');
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/);
  });

  it("change dès qu'un caractère du contenu change (détection d'altération)", async () => {
    expect(await sha256('contenu original')).not.toBe(await sha256('contenu original.'));
  });
});

describe('genererCodeSuivi', () => {
  it('respecte le format XXXX-XXXX sans caractères ambigus', () => {
    for (let i = 0; i < 50; i++) {
      const code = genererCodeSuivi();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });
});

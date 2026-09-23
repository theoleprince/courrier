import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { embarquerPolice, texteEncodable } from '@/services/polices';
import { genererRecepisse } from '@/services/documents';
import type { Correspondant, CourrierEntrant, Parametres } from '@/types/models';

const PIEGE = 'Facture\t2201 — ok ✅ → ≥ 5 € Łódź ‘Ekambi’ 中文';

describe('texteEncodable()', () => {
  it('garde les caractères WinAnsi et remplace les autres', async () => {
    const pdf = await PDFDocument.create();
    const police = await pdf.embedFont(StandardFonts.Helvetica);
    const jeu = new Set(police.getCharacterSet());

    expect(texteEncodable('Réponse n°12 — « œuvre » 5 €', jeu)).toBe('Réponse n°12 — « œuvre » 5 €');
    expect(texteEncodable('a\tb', jeu)).toBe('a    b');
    expect(texteEncodable('Łódź', jeu)).toBe('?ódz'); // ź → z (lettre de base), Ł sans décomposition → ?
    expect(texteEncodable('ok ✅', jeu)).toBe('ok ?');
  });
});

describe('embarquerPolice()', () => {
  it('mesure et dessine un texte piégé sans lever d’exception', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const police = await embarquerPolice(pdf, StandardFonts.Helvetica);

    expect(police.widthOfTextAtSize(PIEGE, 10)).toBeGreaterThan(0);
    expect(() => page.drawText(PIEGE, { x: 10, y: 10, size: 10, font: police })).not.toThrow();
    await expect(pdf.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('permet de générer un récépissé dont l’objet contient une tabulation', async () => {
    const courrier = {
      id: 'c1',
      sens: 'ENTRANT',
      numero: 'ARR-2026-000099',
      codeSuivi: 'TEST-0001',
      objet: PIEGE,
      type: 'FACTURE',
      priorite: 'NORMALE',
      confidentialite: 'INTERNE',
      statut: 'ENREGISTRE',
      correspondantId: 'x1',
      dateReception: '2026-09-23T08:00:00.000Z',
      modeDepot: 'GUICHET',
      deposant: { nom: 'Jean\tAbena' },
      reponseAttendue: false,
      creeLe: '2026-09-23T08:00:00.000Z',
      misAJourLe: '2026-09-23T08:00:00.000Z',
    } as unknown as CourrierEntrant;
    const correspondant = { id: 'x1', nom: 'Bureautique\tPlus ✅', categorie: 'ENTREPRISE' } as Correspondant;
    const parametres = {
      id: 'global',
      nomOrganisation: 'Groupe Sanaga\tIndustries',
      sigle: 'GSI',
      adresse: 'Yaoundé\t→ Bastos',
      couleurPrimaire: '#1d4ed8',
      langue: 'fr',
      delaiEscaladeJours: 2,
      modeDemo: true,
      decalageHorlogeMinutes: 0,
    } as Parametres;

    const blob = await genererRecepisse({
      courrier,
      correspondant,
      parametres,
      nombrePages: 1,
      urlPortail: 'https://poc.local/portail',
      dateAffichee: '23 septembre 2026',
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});

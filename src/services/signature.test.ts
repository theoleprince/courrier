// @vitest-environment node
// Pas de DOM nécessaire ; l'environnement Node fournit Blob.arrayBuffer() et crypto.subtle réels.
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
import { apposerSignature, type InfosApposition } from '@/services/signature';

// PNG 1×1 valide : sert de tracé de signature et de cachet.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const infos: InfosApposition = {
  signatureId: 'sig-1',
  nomSignataire: 'Paul Mbarga',
  posteSignataire: 'Directeur général',
  dateAffichee: '23/09/2026 12:00',
  empreinteAbregee: 'abc',
  imagePngDataUrl: PNG,
  urlVerification: 'https://exemple.test/verifier/sig-1',
};

async function pdfVierge(): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}

/** Nombre d'images posées sur la dernière page (tracé, QR, cachet éventuel). */
async function nombreImages(pdfSigne: Blob): Promise<number> {
  const pdf = await PDFDocument.load(await pdfSigne.arrayBuffer());
  const page = pdf.getPages().at(-1)!;
  const xObjects = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  return xObjects?.keys().length ?? 0;
}

describe('apposerSignature()', () => {
  it('pose le tracé et le QR, sans cachet par défaut', async () => {
    const { pdfSigne } = await apposerSignature(await pdfVierge(), infos);
    expect(await nombreImages(pdfSigne)).toBe(2);
  });

  it('pose aussi le cachet quand il est fourni', async () => {
    const { pdfSigne } = await apposerSignature(await pdfVierge(), { ...infos, cachetPngDataUrl: PNG });
    expect(await nombreImages(pdfSigne)).toBe(3);
  });
});

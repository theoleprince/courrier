import type { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

/**
 * Ramène un texte aux seuls caractères que la police sait encoder. Les polices
 * standard de pdf-lib (encodage WinAnsi) lèvent une exception sur une
 * tabulation, un émoji, une flèche, un caractère non latin… qu'un utilisateur
 * peut saisir ou coller dans un objet, un nom ou une adresse.
 * Tabulation → espaces ; caractère accentué inconnu → sa lettre de base ;
 * sinon → « ? ». Les retours à la ligne sont laissés à l'appelant.
 */
export function texteEncodable(texte: string, jeu: ReadonlySet<number>): string {
  let resultat = '';
  for (const caractere of texte.replace(/\r/g, '').replace(/\t/g, '    ')) {
    const code = caractere.codePointAt(0) ?? 0;
    if (code === 10 || jeu.has(code)) {
      resultat += caractere;
      continue;
    }
    const base = caractere.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const baseEncodable = base.length > 0 && [...base].every((c) => jeu.has(c.codePointAt(0) ?? 0));
    resultat += baseEncodable ? base : '?';
  }
  return resultat;
}

/**
 * Embarque une police standard qui ne plante jamais sur un caractère non
 * encodable : `encodeText` (utilisé par `drawText`) et `widthOfTextAtSize`
 * nettoient d'abord le texte avec {@link texteEncodable}.
 */
export async function embarquerPolice(pdf: PDFDocument, nom: StandardFonts): Promise<PDFFont> {
  const police = await pdf.embedFont(nom);
  const jeu = new Set(police.getCharacterSet());
  const encoder = police.encodeText.bind(police);
  const mesurer = police.widthOfTextAtSize.bind(police);
  police.encodeText = (texte) => encoder(texteEncodable(texte, jeu));
  police.widthOfTextAtSize = (texte, taille) => mesurer(texteEncodable(texte, jeu), taille);
  return police;
}

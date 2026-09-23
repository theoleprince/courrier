import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { embarquerPolice } from '@/services/polices';
import QRCode from 'qrcode';
import { sha256 } from '@/services/crypto';

function dataUrlEnBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? dataUrl;
  const binaire = atob(base64);
  const bytes = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) bytes[i] = binaire.charCodeAt(i);
  return bytes;
}

export interface InfosApposition {
  signatureId: string;
  nomSignataire: string;
  posteSignataire: string;
  dateAffichee: string;
  empreinteAbregee: string;
  imagePngDataUrl: string;
  urlVerification: string;
}

export interface ResultatApposition {
  pdfSigne: Blob;
  empreintePdfSigne: string;
  empreinteSignature: string;
}

/**
 * Appose le tracé de signature, la mention légale et le QR de vérification
 * sur la dernière page du PDF (section 10.3). Fonction pure, appelée hors
 * transaction Dexie par `services/workflow.ts`.
 */
export async function apposerSignature(pdfOriginal: Blob, infos: InfosApposition): Promise<ResultatApposition> {
  const bytes = await pdfOriginal.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();
  const derniere = pages[pages.length - 1];
  const { width } = derniere.getSize();

  const qrDataUrl = await QRCode.toDataURL(infos.urlVerification, { margin: 1, width: 160 });
  const [qrImage, signatureImage, police] = await Promise.all([
    pdf.embedPng(dataUrlEnBytes(qrDataUrl)),
    pdf.embedPng(dataUrlEnBytes(infos.imagePngDataUrl)),
    embarquerPolice(pdf, StandardFonts.Helvetica),
  ]);

  const margeBas = 24;
  const hauteurBloc = 110;
  const largeurBloc = width - 72;

  derniere.drawRectangle({
    x: 36,
    y: margeBas,
    width: largeurBloc,
    height: hauteurBloc,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.6,
  });
  derniere.drawImage(signatureImage, { x: 44, y: margeBas + 22, width: 150, height: 60 });
  derniere.drawImage(qrImage, { x: 36 + largeurBloc - 86, y: margeBas + 8, width: 78, height: 78 });
  derniere.drawText(
    `Signe electroniquement par ${infos.nomSignataire} / ${infos.posteSignataire}, le ${infos.dateAffichee}`,
    { x: 44, y: margeBas + 94, size: 9, font: police, color: rgb(0.15, 0.15, 0.15) },
  );
  derniere.drawText(`Empreinte : ${infos.empreinteAbregee}...`, {
    x: 44,
    y: margeBas + 82,
    size: 8,
    font: police,
    color: rgb(0.35, 0.35, 0.35),
  });
  derniere.drawText('Signature simulee, sans valeur legale dans ce POC.', {
    x: 44,
    y: margeBas + 10,
    size: 7,
    font: police,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdf.save();
  const contenu = new Uint8Array(pdfBytes);
  const pdfSigne = new Blob([contenu], { type: 'application/pdf' });
  const [empreintePdfSigne, empreinteSignature] = await Promise.all([
    sha256(contenu.buffer as ArrayBuffer),
    sha256(infos.imagePngDataUrl),
  ]);

  return { pdfSigne, empreintePdfSigne, empreinteSignature };
}

export interface InfosVisa {
  nomViseur: string;
  posteViseur: string;
  dateAffichee: string;
  paraphePngDataUrl: string;
  /** Rang du visa dans le circuit (0 = premier), pour ne pas superposer les cachets. */
  rang: number;
}

/** Remplace les caractères que la police standard (WinAnsi) ne sait pas encoder. */
function texteWinAnsi(texte: string): string {
  return texte.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF—–]/g, '');
}

/**
 * Appose un cachet de visa (paraphe + mention « Lu et approuvé ») sur chaque
 * page du PDF. Les cachets successifs se rangent de droite à gauche au-dessus
 * du bloc de signature, qui occupe le bas de la dernière page.
 */
export async function apposerVisa(pdfOriginal: Blob, infos: InfosVisa): Promise<Blob> {
  const pdf = await PDFDocument.load(await pdfOriginal.arrayBuffer());
  const [paraphe, police, policeGrasse] = await Promise.all([
    pdf.embedPng(dataUrlEnBytes(infos.paraphePngDataUrl)),
    embarquerPolice(pdf, StandardFonts.Helvetica),
    embarquerPolice(pdf, StandardFonts.HelveticaBold),
  ]);

  const largeur = 128;
  const hauteur = 58;
  const y = 142;
  const couleur = rgb(0.1, 0.25, 0.55);
  const tronquer = (texte: string, taille: number) => {
    let t = texteWinAnsi(texte);
    while (t.length > 1 && police.widthOfTextAtSize(t, taille) > largeur - 58) t = t.slice(0, -1);
    return t;
  };
  const nom = tronquer(infos.nomViseur, 6.5);
  const poste = tronquer(infos.posteViseur, 5.5);

  for (const page of pdf.getPages()) {
    const x = page.getSize().width - 36 - (infos.rang + 1) * (largeur + 6);
    page.drawRectangle({ x, y, width: largeur, height: hauteur, color: rgb(1, 1, 1), opacity: 0.9, borderColor: couleur, borderWidth: 0.8 });
    page.drawText('LU ET APPROUVÉ', { x: x + 4, y: y + hauteur - 10, size: 7, font: policeGrasse, color: couleur });
    page.drawImage(paraphe, { x: x + largeur - 52, y: y + 4, width: 48, height: 30 });
    page.drawText(nom, { x: x + 4, y: y + 26, size: 6.5, font: police, color: couleur });
    page.drawText(poste, { x: x + 4, y: y + 16, size: 5.5, font: police, color: couleur });
    page.drawText(infos.dateAffichee, { x: x + 4, y: y + 5, size: 5.5, font: police, color: couleur });
  }

  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}

/** Compare l'empreinte d'un PDF déposé par un tiers à l'empreinte enregistrée à la signature. */
export async function verifierPdfDepose(pdfDepose: Blob, empreinteAttendue: string): Promise<boolean> {
  const empreinte = await sha256(pdfDepose);
  return empreinte === empreinteAttendue;
}

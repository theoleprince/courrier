import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { embarquerPolice } from '@/services/polices';
import QRCode from 'qrcode';
import type { Correspondant, Courrier, CourrierEntrant, ModeleLettre, Parametres } from '@/types/models';

function dataUrlEnBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? dataUrl;
  const binaire = atob(base64);
  const bytes = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) bytes[i] = binaire.charCodeAt(i);
  return bytes;
}

function hexEnRgb(hex: string): { r: number; g: number; b: number } {
  const nettoye = hex.replace('#', '');
  const valeur = parseInt(nettoye, 16);
  return { r: ((valeur >> 16) & 255) / 255, g: ((valeur >> 8) & 255) / 255, b: (valeur & 255) / 255 };
}

function decouperTexte(texte: string, police: PDFFont, taille: number, largeurMax: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split('\n')) {
    let ligneCourante = '';
    for (const mot of paragraphe.split(' ')) {
      const essai = ligneCourante ? `${ligneCourante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) > largeurMax && ligneCourante) {
        lignes.push(ligneCourante);
        ligneCourante = mot;
      } else {
        ligneCourante = essai;
      }
    }
    lignes.push(ligneCourante);
  }
  return lignes;
}

async function dessinerEnTete(
  pdf: PDFDocument,
  page: PDFPage,
  parametres: Parametres,
  police: PDFFont,
  policeGrasse: PDFFont,
): Promise<number> {
  const { width, height } = page.getSize();
  const couleur = hexEnRgb(parametres.couleurPrimaire);

  if (parametres.logoPng) {
    try {
      const logo = await pdf.embedPng(dataUrlEnBytes(parametres.logoPng));
      page.drawImage(logo, { x: 40, y: height - 76, width: 40, height: 40 });
    } catch {
      // logo non embarquable (format inattendu) : on continue sans logo
    }
  }

  page.drawText(parametres.nomOrganisation, {
    x: 88,
    y: height - 50,
    size: 13,
    font: policeGrasse,
    color: rgb(couleur.r, couleur.g, couleur.b),
  });
  page.drawText(parametres.adresse, { x: 88, y: height - 65, size: 8, font: police, color: rgb(0.3, 0.3, 0.3) });
  if (parametres.telephone || parametres.email) {
    page.drawText([parametres.telephone, parametres.email].filter(Boolean).join(' · '), {
      x: 88,
      y: height - 76,
      size: 8,
      font: police,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  page.drawLine({
    start: { x: 40, y: height - 90 },
    end: { x: width - 40, y: height - 90 },
    thickness: 1.2,
    color: rgb(couleur.r, couleur.g, couleur.b),
  });

  return height - 90;
}

/* ------------------------------------------------------------------ */
/* Récépissé de dépôt (A5, section 12.1)                                */
/* ------------------------------------------------------------------ */

export interface DonneesRecepisse {
  courrier: CourrierEntrant;
  correspondant: Correspondant;
  parametres: Parametres;
  nombrePages: number;
  urlPortail: string;
  dateAffichee: string;
}

export async function genererRecepisse(donnees: DonneesRecepisse): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]); // A5 portrait (points)
  const police = await embarquerPolice(pdf, StandardFonts.Helvetica);
  const policeGrasse = await embarquerPolice(pdf, StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  let y = await dessinerEnTete(pdf, page, donnees.parametres, police, policeGrasse);
  y -= 30;

  page.drawText('RÉCÉPISSÉ DE DÉPÔT', { x: 40, y, size: 14, font: policeGrasse });
  y -= 28;

  page.drawText('Code de suivi', { x: 40, y, size: 8, font: police, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;
  page.drawText(donnees.courrier.codeSuivi, { x: 40, y, size: 22, font: policeGrasse });
  y -= 34;

  const champ = (libelle: string, valeur: string) => {
    page.drawText(libelle, { x: 40, y, size: 8, font: police, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(valeur, { x: 160, y, size: 10, font: police });
    y -= 18;
  };

  champ('Numéro', donnees.courrier.numero ?? '—');
  champ('Reçu le', donnees.dateAffichee);
  champ('Correspondant', donnees.correspondant.nom);
  if (donnees.courrier.deposant?.nom) champ('Déposé par', donnees.courrier.deposant.nom);
  if (donnees.courrier.confidentialite !== 'CONFIDENTIEL') {
    const lignesObjet = decouperTexte(donnees.courrier.objet, police, 10, width - 200);
    page.drawText('Objet', { x: 40, y, size: 8, font: police, color: rgb(0.4, 0.4, 0.4) });
    lignesObjet.forEach((ligne, i) => page.drawText(ligne, { x: 160, y: y - i * 12, size: 10, font: police }));
    y -= 12 * lignesObjet.length + 6;
  }
  champ('Nombre de pages', String(donnees.nombrePages));

  y -= 20;
  const qr = await QRCode.toDataURL(donnees.urlPortail, { margin: 1, width: 140 });
  const qrImage = await pdf.embedPng(dataUrlEnBytes(qr));
  page.drawImage(qrImage, { x: width - 40 - 100, y: y - 100, width: 100, height: 100 });

  page.drawText('Suivez votre courrier sur notre portail', { x: 40, y, size: 9, font: police });
  page.drawText('ou à l’accueil avec ce code.', { x: 40, y: y - 13, size: 9, font: police });

  page.drawText('Bureau d’ordre', {
    x: 40,
    y: 40,
    size: 9,
    font: policeGrasse,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawRectangle({ x: 36, y: 32, width: 110, height: 26, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.8 });

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/* ------------------------------------------------------------------ */
/* Lettre depuis modèle (section 12.2)                                  */
/* ------------------------------------------------------------------ */

export function remplacerVariables(gabarit: string, variables: Record<string, string>): string {
  return gabarit.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (correspondance, cle: string) => variables[cle] ?? correspondance);
}

export interface VariablesLettre {
  'correspondant.nom'?: string;
  'correspondant.organisation'?: string;
  'correspondant.adresse'?: string;
  'entrant.numero'?: string;
  'entrant.referenceExpediteur'?: string;
  'entrant.dateCourrier'?: string;
  'entrant.objet'?: string;
  'redacteur.nom'?: string;
  'signataire.nom'?: string;
  'signataire.poste'?: string;
  date?: string;
  'organisation.nom'?: string;
}

export interface DonneesLettre {
  parametres: Parametres;
  objet: string;
  corps: string;
  correspondant: Correspondant;
  referenceCourrier?: string;
  dateAffichee: string;
}

/** Génère le PDF d'une lettre (brouillon ou aperçu) ; le bloc de signature reste vide. */
export async function genererLettrePdf(donnees: DonneesLettre): Promise<Blob> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]); // A4 portrait
  const police = await embarquerPolice(pdf, StandardFonts.Helvetica);
  const policeGrasse = await embarquerPolice(pdf, StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const margeGauche = 56;
  const largeurTexte = width - margeGauche * 2;

  let y = await dessinerEnTete(pdf, page, donnees.parametres, police, policeGrasse);
  y -= 30;

  if (donnees.referenceCourrier) {
    page.drawText(`V/Réf : ${donnees.referenceCourrier}`, { x: margeGauche, y, size: 9, font: police });
    y -= 16;
  }
  page.drawText(`Yaoundé, le ${donnees.dateAffichee}`, { x: width - 220, y: y + (donnees.referenceCourrier ? 16 : 0), size: 9, font: police });
  y -= 10;

  page.drawText(donnees.correspondant.nom, { x: margeGauche, y, size: 10, font: policeGrasse });
  y -= 14;
  if (donnees.correspondant.organisation) {
    page.drawText(donnees.correspondant.organisation, { x: margeGauche, y, size: 9, font: police });
    y -= 13;
  }
  if (donnees.correspondant.adresse) {
    page.drawText(donnees.correspondant.adresse, { x: margeGauche, y, size: 9, font: police });
    y -= 13;
  }
  y -= 20;

  page.drawText(`Objet : ${donnees.objet}`, { x: margeGauche, y, size: 10, font: policeGrasse });
  y -= 28;

  const lignes = decouperTexte(donnees.corps, police, 10, largeurTexte);
  for (const ligne of lignes) {
    if (y < 160) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - 60;
    }
    page.drawText(ligne, { x: margeGauche, y, size: 10, font: police, lineHeight: 14 });
    y -= 15;
  }

  y = Math.min(y, 140);
  page.drawText('Le responsable,', { x: width - 220, y, size: 9, font: police });
  page.drawRectangle({
    x: width - 220,
    y: y - 90,
    width: 160,
    height: 80,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.6,
    borderDashArray: [3, 3],
  });

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/* ------------------------------------------------------------------ */
/* Assemblage d'images en un seul PDF (scan multi-pages)                */
/* ------------------------------------------------------------------ */

export async function assemblerFichiersEnPdf(fichiers: File[]): Promise<Blob> {
  const pdf = await PDFDocument.create();

  for (const fichier of fichiers) {
    const bytes = new Uint8Array(await fichier.arrayBuffer());
    if (fichier.type === 'application/pdf') {
      const source = await PDFDocument.load(bytes);
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach((p) => pdf.addPage(p));
      continue;
    }

    const image = fichier.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const marge = 24;
    const largeurDisponible = 595 - marge * 2;
    const hauteurDisponible = 842 - marge * 2;
    const ratio = Math.min(largeurDisponible / image.width, hauteurDisponible / image.height, 1);
    const page = pdf.addPage([595, 842]);
    page.drawImage(image, {
      x: (595 - image.width * ratio) / 2,
      y: (842 - image.height * ratio) / 2,
      width: image.width * ratio,
      height: image.height * ratio,
    });
  }

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export function variablesDepuisLettre(modele: ModeleLettre): string[] {
  const trouvees = new Set<string>();
  for (const correspondance of `${modele.objet} ${modele.corps}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    trouvees.add(correspondance[1]);
  }
  return [...trouvees];
}

/* ------------------------------------------------------------------ */
/* Bordereau de transmission et registre chronologique (section 12.3/12.4) */
/* ------------------------------------------------------------------ */

export interface LigneRegistre {
  courrier: Courrier;
  correspondant?: Correspondant;
  nombrePieces: number;
}

const COLONNES_REGISTRE = [
  { titre: 'Numéro', x: 40, largeur: 90 },
  { titre: 'Date', x: 130, largeur: 55 },
  { titre: 'Objet', x: 185, largeur: 215 },
  { titre: 'Correspondant', x: 400, largeur: 110 },
  { titre: 'Pièces', x: 515, largeur: 40 },
];

/** Dessine les en-têtes de colonnes à la position `y` fournie et renvoie le nouveau `y`. */
function dessinerEntetesRegistre(page: PDFPage, y: number, policeGrasse: PDFFont): number {
  for (const colonne of COLONNES_REGISTRE) {
    page.drawText(colonne.titre, { x: colonne.x, y, size: 9, font: policeGrasse, color: rgb(0.35, 0.35, 0.35) });
  }
  const yLigne = y - 4;
  page.drawLine({ start: { x: 40, y: yLigne }, end: { x: 555, y: yLigne }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
  return yLigne - 14;
}

function dessinerLigneRegistre(page: PDFPage, y: number, police: PDFFont, ligne: LigneRegistre): void {
  const c = ligne.courrier;
  page.drawText(c.numero ?? c.codeSuivi, { x: COLONNES_REGISTRE[0].x, y, size: 9, font: police });
  page.drawText(new Date(c.creeLe).toLocaleDateString('fr-FR'), { x: COLONNES_REGISTRE[1].x, y, size: 9, font: police });
  const objet = decouperTexte(c.objet, police, 9, COLONNES_REGISTRE[2].largeur)[0] ?? '';
  page.drawText(objet, { x: COLONNES_REGISTRE[2].x, y, size: 9, font: police });
  const nomCorrespondant = decouperTexte(ligne.correspondant?.nom ?? '', police, 9, COLONNES_REGISTRE[3].largeur)[0] ?? '';
  page.drawText(nomCorrespondant, { x: COLONNES_REGISTRE[3].x, y, size: 9, font: police });
  page.drawText(String(ligne.nombrePieces), { x: COLONNES_REGISTRE[4].x, y, size: 9, font: police });
}

export interface DonneesRegistre {
  parametres: Parametres;
  titre: string;
  periode: string;
  lignes: LigneRegistre[];
}

/** Registre chronologique (arrivée ou départ), paginé et numéroté (section 12.4). */
export async function genererRegistrePdf(donnees: DonneesRegistre): Promise<Blob> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const police = await embarquerPolice(pdf, StandardFonts.Helvetica);
  const policeGrasse = await embarquerPolice(pdf, StandardFonts.HelveticaBold);

  let y = await dessinerEnTete(pdf, page, donnees.parametres, police, policeGrasse);
  y -= 26;
  page.drawText(donnees.titre.toUpperCase(), { x: 40, y, size: 14, font: policeGrasse });
  y -= 16;
  page.drawText(donnees.periode, { x: 40, y, size: 9, font: police, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;
  y = dessinerEntetesRegistre(page, y, policeGrasse);

  donnees.lignes.forEach((ligne, index) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - 50;
      y = dessinerEntetesRegistre(page, y, policeGrasse);
    }
    page.drawText(String(index + 1), { x: 20, y, size: 8, font: police, color: rgb(0.6, 0.6, 0.6) });
    dessinerLigneRegistre(page, y, police, ligne);
    y -= 16;
  });

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/** Export CSV du registre chronologique (section 12.4). */
export function genererRegistreCsv(lignes: LigneRegistre[]): Blob {
  const echapper = (valeur: string) => `"${valeur.replace(/"/g, '""')}"`;
  const entetes = ['Numéro', 'Code de suivi', 'Date', 'Objet', 'Correspondant', 'Type', 'Priorité', 'Statut', 'Pièces'];
  const lignesCsv = lignes.map((ligne) =>
    [
      ligne.courrier.numero ?? '',
      ligne.courrier.codeSuivi,
      new Date(ligne.courrier.creeLe).toLocaleDateString('fr-FR'),
      ligne.courrier.objet,
      ligne.correspondant?.nom ?? '',
      ligne.courrier.type,
      ligne.courrier.priorite,
      ligne.courrier.statut,
      String(ligne.nombrePieces),
    ]
      .map(echapper)
      .join(';'),
  );
  const contenu = [entetes.map(echapper).join(';'), ...lignesCsv].join('\r\n');
  return new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8' });
}

export interface DonneesBordereau {
  parametres: Parametres;
  entiteDestinataire: string;
  dateAffichee: string;
  lignes: LigneRegistre[];
}

/** Bordereau de transmission physique (section 12.3), avec cases « Remis par » / « Reçu par ». */
export async function genererBordereauPdf(donnees: DonneesBordereau): Promise<Blob> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const police = await embarquerPolice(pdf, StandardFonts.Helvetica);
  const policeGrasse = await embarquerPolice(pdf, StandardFonts.HelveticaBold);

  let y = await dessinerEnTete(pdf, page, donnees.parametres, police, policeGrasse);
  y -= 26;
  page.drawText('BORDEREAU DE TRANSMISSION', { x: 40, y, size: 14, font: policeGrasse });
  y -= 18;
  page.drawText(`Destinataire : ${donnees.entiteDestinataire}`, { x: 40, y, size: 10, font: police });
  y -= 14;
  page.drawText(`Le ${donnees.dateAffichee}`, { x: 40, y, size: 10, font: police });
  y -= 24;
  y = dessinerEntetesRegistre(page, y, policeGrasse);

  for (const ligne of donnees.lignes) {
    if (y < 140) {
      page = pdf.addPage([595, 842]);
      y = page.getSize().height - 50;
      y = dessinerEntetesRegistre(page, y, policeGrasse);
    }
    dessinerLigneRegistre(page, y, police, ligne);
    y -= 16;
  }

  y -= 30;
  if (y < 110) {
    page = pdf.addPage([595, 842]);
    y = page.getSize().height - 80;
  }
  const largeurBloc = 230;
  page.drawText('Remis par :', { x: 40, y, size: 10, font: policeGrasse });
  page.drawText('Reçu par, date, signature :', { x: 40 + largeurBloc + 20, y, size: 10, font: policeGrasse });
  page.drawRectangle({ x: 40, y: y - 70, width: largeurBloc, height: 60, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.6 });
  page.drawRectangle({
    x: 40 + largeurBloc + 20,
    y: y - 70,
    width: largeurBloc,
    height: 60,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.6,
  });

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

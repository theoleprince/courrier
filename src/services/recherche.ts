import Dexie from 'dexie';
import MiniSearch from 'minisearch';
import { db } from '@/db/db';
import { niveauAcces, objetAffiche } from '@/services/requetes';
import type { ActeurCourant } from '@/hooks/useActeur';
import type { Correspondant, Courrier, ID } from '@/types/models';

interface DocumentIndexe {
  id: string;
  kind: 'courrier' | 'correspondant';
  numero?: string;
  codeSuivi?: string;
  objet?: string;
  motsCles?: string;
  correspondant?: string;
  deposant?: string;
  referenceExpediteur?: string;
  texteOcr?: string;
  telephone?: string;
  email?: string;
  organisation?: string;
}

let index: MiniSearch<DocumentIndexe> | undefined;

function nouvelIndex(): MiniSearch<DocumentIndexe> {
  return new MiniSearch<DocumentIndexe>({
    idField: 'id',
    fields: [
      'numero',
      'codeSuivi',
      'objet',
      'motsCles',
      'correspondant',
      'deposant',
      'referenceExpediteur',
      'texteOcr',
      'telephone',
      'email',
      'organisation',
    ],
    storeFields: ['kind'],
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { numero: 3, codeSuivi: 3, objet: 2, correspondant: 2 } },
  });
}

async function documentCourrier(courrier: Courrier): Promise<DocumentIndexe> {
  const correspondant = await db.correspondants.get(courrier.correspondantId);
  const piecesOcr = await db.piecesJointes.where('courrierId').equals(courrier.id).toArray();
  return {
    id: `courrier:${courrier.id}`,
    kind: 'courrier',
    numero: courrier.numero ?? undefined,
    codeSuivi: courrier.codeSuivi,
    objet: courrier.objet,
    motsCles: courrier.motsCles.join(' '),
    correspondant: correspondant ? `${correspondant.nom} ${correspondant.organisation ?? ''}` : '',
    deposant: courrier.sens === 'ENTRANT' ? courrier.deposant?.nom ?? '' : '',
    referenceExpediteur: courrier.sens === 'ENTRANT' ? courrier.referenceExpediteur ?? '' : '',
    texteOcr: piecesOcr.map((p) => p.texteOcr ?? '').join(' '),
  };
}

function documentCorrespondant(correspondant: Correspondant): DocumentIndexe {
  return {
    id: `correspondant:${correspondant.id}`,
    kind: 'correspondant',
    correspondant: correspondant.nom,
    organisation: correspondant.organisation ?? '',
    telephone: correspondant.telephone ?? '',
    email: correspondant.email ?? '',
  };
}

/** Construit l'index en mémoire depuis Dexie et l'abonne aux écritures futures. Idempotent. */
export async function initialiserIndex(): Promise<void> {
  if (index) return;
  index = nouvelIndex();

  const [courriers, correspondants] = await Promise.all([db.courriers.toArray(), db.correspondants.toArray()]);
  const documents = await Promise.all(courriers.map(documentCourrier));
  index.addAll(documents);
  index.addAll(correspondants.map(documentCorrespondant));

  // Dexie.ignoreTransaction() est indispensable ici : les hooks 'creating'/'updating'
  // s'exécutent dans la transaction ambiante de l'appelant (ex. enregistrerEntrant),
  // et documentCourrier() lit d'autres tables (correspondants, piecesJointes) de façon
  // asynchrone. Sans cet échappement, ces lectures tentent de rejoindre une transaction
  // qui ne les couvre pas forcément et Dexie lève une erreur (règle des transactions,
  // section 3 des spécifications — même principe que pour crypto.subtle/pdf-lib).
  db.courriers.hook('creating', (_pk, obj) => {
    Dexie.ignoreTransaction(() => {
      void documentCourrier(obj as Courrier).then((doc) => index?.add(doc));
    });
  });
  db.courriers.hook('updating', (_mods, _pk, obj) => {
    Dexie.ignoreTransaction(() => {
      void documentCourrier(obj as Courrier).then((doc) => {
        if (index?.has(doc.id)) index.replace(doc);
        else index?.add(doc);
      });
    });
  });
  db.correspondants.hook('creating', (_pk, obj) => {
    index?.add(documentCorrespondant(obj as Correspondant));
  });
  db.correspondants.hook('updating', (_mods, _pk, obj) => {
    const doc = documentCorrespondant(obj as Correspondant);
    if (index?.has(doc.id)) index.replace(doc);
    else index?.add(doc);
  });
}

export interface ResultatRechercheCourrier {
  type: 'courrier';
  courrier: Courrier;
  objetAffiche: string;
}
export interface ResultatRechercheCorrespondant {
  type: 'correspondant';
  correspondant: Correspondant;
}
export type ResultatRecherche = ResultatRechercheCourrier | ResultatRechercheCorrespondant;

/** Recherche globale (section 9.1), filtrée par la visibilité de l'acteur au moment de l'affichage. */
export async function rechercherGlobal(
  texte: string,
  acteur: Pick<ActeurCourant, 'personne' | 'poste'>,
  limite = 20,
): Promise<ResultatRecherche[]> {
  if (!index) await initialiserIndex();
  if (!texte.trim()) return [];

  const correspondances = index!.search(texte.replace(/-/g, ' '));
  const resultats: ResultatRecherche[] = [];

  for (const correspondance of correspondances) {
    if (resultats.length >= limite) break;
    const [kind, id] = String(correspondance.id).split(':') as ['courrier' | 'correspondant', ID];

    if (kind === 'courrier') {
      const courrier = await db.courriers.get(id);
      if (!courrier) continue;
      const niveau = await niveauAcces(courrier, acteur);
      if (niveau === 'AUCUN') continue;
      resultats.push({ type: 'courrier', courrier, objetAffiche: objetAffiche(courrier, niveau) });
    } else {
      const correspondant = await db.correspondants.get(id);
      if (correspondant) resultats.push({ type: 'correspondant', correspondant });
    }
  }

  return resultats;
}

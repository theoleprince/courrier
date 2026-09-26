import { db } from '@/db/db';
import { uid } from '@/services/crypto';
import { genererLogoMonogramme } from '@/db/logo';
import type {
  Correspondant,
  Entite,
  EtapeModele,
  ID,
  ModeleCircuit,
  ModeleLettre,
  Personne,
  Poste,
} from '@/types/models';

function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function emailDe(prenom: string, nom: string): string {
  const partie = (s: string) => sansAccents(s).toLowerCase().replace(/[^a-z]/g, '.');
  return `${partie(prenom)}.${partie(nom)}@sanaga-industries.cm`;
}

/**
 * Seed de l'organisation et des paramètres (lot 1). Idempotent : ne fait rien
 * si les paramètres existent déjà (voir `estDejaInitialisee`).
 */
export async function estDejaInitialisee(): Promise<boolean> {
  return (await db.parametres.get('global')) !== undefined;
}

export async function seedOrganisation(): Promise<void> {
  if (await estDejaInitialisee()) return;

  const idEntite = (partiel: Omit<Entite, 'id' | 'actif'>): Entite => ({
    ...partiel,
    id: uid(),
    actif: true,
  });

  const dg = idEntite({ code: 'DG', libelle: 'Direction générale', type: 'DIRECTION', parentId: null });
  const sg = idEntite({ code: 'SG', libelle: 'Secrétariat général', type: 'DEPARTEMENT', parentId: dg.id });
  const accueil = idEntite({ code: 'ACC', libelle: 'Accueil', type: 'SERVICE', parentId: sg.id });
  const bo = idEntite({ code: 'BO', libelle: 'Bureau d’ordre', type: 'SERVICE', parentId: sg.id });
  const daf = idEntite({
    code: 'DAF',
    libelle: 'Direction administrative et financière',
    type: 'DIRECTION',
    parentId: dg.id,
  });
  const cpt = idEntite({ code: 'CPT', libelle: 'Service comptabilité', type: 'SERVICE', parentId: daf.id });
  const rh = idEntite({ code: 'RH', libelle: 'Service ressources humaines', type: 'SERVICE', parentId: daf.id });
  const dt = idEntite({ code: 'DT', libelle: 'Direction technique', type: 'DIRECTION', parentId: dg.id });
  const mnt = idEntite({ code: 'MNT', libelle: 'Service maintenance', type: 'SERVICE', parentId: dt.id });

  const entites: Entite[] = [dg, sg, accueil, bo, daf, cpt, rh, dt, mnt];

  const idPoste = (partiel: Omit<Poste, 'id' | 'actif'>): Poste => ({
    ...partiel,
    id: uid(),
    actif: true,
  });

  const posteDG = idPoste({ libelle: 'Directeur général', entiteId: dg.id, role: 'DG', estResponsable: true, peutSigner: true });
  const posteAssistanteDG = idPoste({ libelle: 'Assistante de direction', entiteId: dg.id, role: 'AGENT', estResponsable: false, peutSigner: false });
  const posteSG = idPoste({ libelle: 'Secrétaire général', entiteId: sg.id, role: 'DIRECTEUR', estResponsable: true, peutSigner: false });
  const posteAdmin = idPoste({ libelle: 'Administrateur fonctionnel', entiteId: sg.id, role: 'ADMIN', estResponsable: false, peutSigner: false });
  const posteAccueil = idPoste({ libelle: 'Chargée d’accueil', entiteId: accueil.id, role: 'ACCUEIL', estResponsable: true, peutSigner: false });
  const posteAgentBO = idPoste({ libelle: 'Agent du bureau d’ordre', entiteId: bo.id, role: 'BUREAU_ORDRE', estResponsable: false, peutSigner: false });
  const posteChefBO = idPoste({ libelle: 'Chef du bureau d’ordre', entiteId: bo.id, role: 'BUREAU_ORDRE', estResponsable: true, peutSigner: false });
  const posteDAF = idPoste({ libelle: 'Directeur administratif et financier', entiteId: daf.id, role: 'DIRECTEUR', estResponsable: true, peutSigner: true });
  const posteChefCPT = idPoste({ libelle: 'Chef du service comptabilité', entiteId: cpt.id, role: 'CHEF', estResponsable: true, peutSigner: false });
  const posteComptable = idPoste({ libelle: 'Comptable', entiteId: cpt.id, role: 'AGENT', estResponsable: false, peutSigner: false });
  const posteChefRH = idPoste({ libelle: 'Chef du service RH', entiteId: rh.id, role: 'CHEF', estResponsable: true, peutSigner: false });
  const posteDT = idPoste({ libelle: 'Directeur technique', entiteId: dt.id, role: 'DIRECTEUR', estResponsable: true, peutSigner: true });
  const posteChefMNT = idPoste({ libelle: 'Chef du service maintenance', entiteId: mnt.id, role: 'CHEF', estResponsable: true, peutSigner: false });
  const posteTechnicien = idPoste({ libelle: 'Technicien', entiteId: mnt.id, role: 'AGENT', estResponsable: false, peutSigner: false });

  const postes: Poste[] = [
    posteDG,
    posteSG,
    posteAdmin,
    posteAccueil,
    posteAgentBO,
    posteChefBO,
    posteDAF,
    posteChefCPT,
    posteComptable,
    posteChefRH,
    posteDT,
    posteChefMNT,
    posteTechnicien,
    posteAssistanteDG,
  ];

  const MOT_DE_PASSE_DEFAUT = '123456789';

  const idPersonne = (
    prenom: string,
    nom: string,
    posteId: ID | null,
    interimPosteIds: ID[] = [],
  ): Personne => ({
    id: uid(),
    nom,
    prenom,
    email: emailDe(prenom, nom),
    posteId,
    interimPosteIds,
    actif: true,
    motDePasse: MOT_DE_PASSE_DEFAUT,
  });

  const personnes: Personne[] = [
    idPersonne('Paul', 'Mbarga', posteDG.id),
    idPersonne('Aïcha', 'Bello', posteSG.id),
    idPersonne('Admin', 'POC', posteAdmin.id),
    idPersonne('Mireille', 'Ondoa', posteAccueil.id),
    idPersonne('Carine', 'Ngo Bassong', posteAgentBO.id),
    idPersonne('Ernest', 'Fouda', posteChefBO.id),
    idPersonne('Samuel', 'Tchoupo', posteDAF.id),
    idPersonne('Grâce', 'Eyenga', posteChefCPT.id, [posteChefRH.id]),
    idPersonne('Idriss', 'Moussa', posteComptable.id),
    idPersonne('Brenda', 'Nkeng', posteChefRH.id),
    idPersonne('Hervé', 'Kamga', posteDT.id),
    idPersonne('Josiane', 'Atangana', posteChefMNT.id),
    idPersonne('Rodrigue', 'Essomba', posteTechnicien.id),
    idPersonne('Nadège', 'Owona', posteAssistanteDG.id),
  ];

  const idCorrespondant = (partiel: Omit<Correspondant, 'id'>): Correspondant => ({
    ...partiel,
    id: uid(),
  });

  const correspondants: Correspondant[] = [
    idCorrespondant({ nom: 'Banque Atlantique Centrale', categorie: 'ENTREPRISE', adresse: 'Boulevard du 20 Mai, Yaoundé', telephone: '+237 233 42 10 10', email: 'contact@banque-atlantique-centrale.example' }),
    idCorrespondant({ nom: 'Transports Nkolbisson SARL', categorie: 'ENTREPRISE', adresse: 'Zone industrielle de Nkolbisson', telephone: '+237 677 12 34 56' }),
    idCorrespondant({ nom: 'Cabinet Ekambi & Associés', organisation: 'Cabinet Ekambi & Associés', categorie: 'ENTREPRISE', adresse: 'Immeuble Ekambi, Bastos, Yaoundé', email: 'cabinet@ekambi-associes.example' }),
    idCorrespondant({ nom: 'Bureautique Plus', categorie: 'ENTREPRISE', adresse: 'Avenue Kennedy, Yaoundé', telephone: '+237 699 88 77 66' }),
    idCorrespondant({ nom: 'Mairie d’arrondissement', categorie: 'ADMINISTRATION', adresse: 'Hôtel de ville, Yaoundé' }),
    idCorrespondant({ nom: 'Jean-Claude Abena', categorie: 'PARTICULIER', telephone: '+237 655 44 33 22', adresse: 'Quartier Mvog-Ada, Yaoundé' }),
    idCorrespondant({ nom: 'Fadimatou Hamadou', categorie: 'PARTICULIER', telephone: '+237 690 11 22 33', adresse: 'Quartier Tsinga, Yaoundé' }),
    idCorrespondant({ nom: 'Société d’Assurances du Littoral', categorie: 'ENTREPRISE', adresse: 'Akwa, Douala', email: 'contact@assurances-littoral.example' }),
  ];

  const idCircuit = (partiel: Omit<ModeleCircuit, 'id' | 'actif'>): ModeleCircuit => ({
    ...partiel,
    id: uid(),
    actif: true,
  });
  const etape = (partiel: EtapeModele): EtapeModele => partiel;

  const modelesCircuit: ModeleCircuit[] = [
    idCircuit({
      libelle: 'Entrant standard',
      sens: 'ENTRANT',
      typesCourrier: [],
      etapes: [
        etape({ ordre: 1, type: 'IMPUTATION', libelle: 'Imputation', posteCibleId: posteSG.id, delaiJours: 1, sauterSiRedacteur: false }),
        etape({ ordre: 2, type: 'TRAITEMENT', libelle: 'Traitement', roleCible: 'RESPONSABLE_ENTITE_TRAITANTE', delaiJours: 5, sauterSiRedacteur: false }),
        etape({ ordre: 3, type: 'VALIDATION', libelle: 'Validation du directeur', roleCible: 'DIRECTEUR_ENTITE_TRAITANTE', delaiJours: 2, sauterSiRedacteur: true }),
      ],
    }),
    idCircuit({
      libelle: 'Facture fournisseur',
      sens: 'ENTRANT',
      typesCourrier: ['FACTURE'],
      etapes: [
        etape({ ordre: 1, type: 'IMPUTATION', libelle: 'Imputation', posteCibleId: posteSG.id, delaiJours: 1, sauterSiRedacteur: false }),
        etape({ ordre: 2, type: 'TRAITEMENT', libelle: 'Contrôle comptable', roleCible: 'RESPONSABLE_ENTITE_TRAITANTE', delaiJours: 3, sauterSiRedacteur: false }),
        etape({ ordre: 3, type: 'VISA', libelle: 'Visa du DAF', posteCibleId: posteDAF.id, delaiJours: 2, sauterSiRedacteur: true }),
      ],
    }),
    idCircuit({
      libelle: 'Réclamation',
      sens: 'ENTRANT',
      typesCourrier: ['RECLAMATION'],
      etapes: [
        etape({ ordre: 1, type: 'IMPUTATION', libelle: 'Imputation', posteCibleId: posteSG.id, delaiJours: 1, sauterSiRedacteur: false }),
        etape({ ordre: 2, type: 'TRAITEMENT', libelle: 'Traitement', roleCible: 'RESPONSABLE_ENTITE_TRAITANTE', delaiJours: 3, sauterSiRedacteur: false }),
        etape({ ordre: 3, type: 'VALIDATION', libelle: 'Validation du directeur', roleCible: 'DIRECTEUR_ENTITE_TRAITANTE', delaiJours: 2, sauterSiRedacteur: true }),
      ],
    }),
    idCircuit({
      libelle: 'Sortant standard',
      sens: 'SORTANT',
      typesCourrier: [],
      etapes: [
        etape({ ordre: 1, type: 'VISA', libelle: 'Visa du chef de service', roleCible: 'RESPONSABLE_ENTITE_TRAITANTE', delaiJours: 2, sauterSiRedacteur: true }),
        etape({ ordre: 2, type: 'VALIDATION', libelle: 'Validation du directeur', roleCible: 'DIRECTEUR_ENTITE_TRAITANTE', delaiJours: 2, sauterSiRedacteur: true }),
        etape({ ordre: 3, type: 'SIGNATURE', libelle: 'Signature du DG', posteCibleId: posteDG.id, delaiJours: 2, sauterSiRedacteur: false }),
        etape({ ordre: 4, type: 'EXPEDITION', libelle: 'Expédition', roleCible: 'BUREAU_ORDRE', delaiJours: 1, sauterSiRedacteur: false }),
      ],
    }),
  ];

  const idLettre = (partiel: Omit<ModeleLettre, 'id'>): ModeleLettre => ({ ...partiel, id: uid() });

  const modelesLettre: ModeleLettre[] = [
    idLettre({
      libelle: 'Accusé de réception',
      langue: 'fr',
      typesCourrier: [],
      objet: 'Accusé de réception de votre courrier {{entrant.numero}}',
      corps:
        'Nous accusons réception de votre courrier référencé {{entrant.numero}}, reçu le {{entrant.dateCourrier}}, ayant pour objet « {{entrant.objet}} ».\n\nIl a été enregistré et transmis au service compétent. Nous ne manquerons pas de vous tenir informé(e) de la suite qui lui sera réservée.',
    }),
    idLettre({
      libelle: 'Acknowledgement of receipt',
      langue: 'en',
      typesCourrier: [],
      objet: 'Acknowledgement of receipt of your letter {{entrant.numero}}',
      corps:
        'We acknowledge receipt of your letter referenced {{entrant.numero}}, received on {{entrant.dateCourrier}}, regarding "{{entrant.objet}}".\n\nIt has been registered and forwarded to the relevant department. We will keep you informed of its progress.',
    }),
    idLettre({
      libelle: 'Réponse favorable',
      langue: 'fr',
      typesCourrier: [],
      objet: 'Réponse à votre courrier {{entrant.numero}}',
      corps:
        'Faisant suite à votre courrier {{entrant.numero}} du {{entrant.dateCourrier}} relatif à « {{entrant.objet}} », nous avons le plaisir de vous informer qu’une suite favorable y est réservée.\n\nNous restons à votre disposition pour toute information complémentaire.',
    }),
    idLettre({
      libelle: 'Favourable response',
      langue: 'en',
      typesCourrier: [],
      objet: 'Response to your letter {{entrant.numero}}',
      corps:
        'Further to your letter {{entrant.numero}} dated {{entrant.dateCourrier}} regarding "{{entrant.objet}}", we are pleased to inform you that a favourable outcome has been granted.\n\nWe remain at your disposal for any further information.',
    }),
    idLettre({
      libelle: 'Réponse défavorable',
      langue: 'fr',
      typesCourrier: [],
      objet: 'Réponse à votre courrier {{entrant.numero}}',
      corps:
        'Faisant suite à votre courrier {{entrant.numero}} du {{entrant.dateCourrier}} relatif à « {{entrant.objet}} », nous sommes au regret de vous informer qu’il ne peut être donné une suite favorable à votre demande.\n\nNous restons à votre disposition pour toute information complémentaire.',
    }),
    idLettre({
      libelle: 'Unfavourable response',
      langue: 'en',
      typesCourrier: [],
      objet: 'Response to your letter {{entrant.numero}}',
      corps:
        'Further to your letter {{entrant.numero}} dated {{entrant.dateCourrier}} regarding "{{entrant.objet}}", we regret to inform you that your request cannot be granted.\n\nWe remain at your disposal for any further information.',
    }),
    idLettre({
      libelle: 'Demande de pièces complémentaires',
      langue: 'fr',
      typesCourrier: ['DEMANDE', 'RECLAMATION'],
      objet: 'Pièces complémentaires requises — dossier {{entrant.numero}}',
      corps:
        'Nous faisons suite à votre courrier {{entrant.numero}} du {{entrant.dateCourrier}} concernant « {{entrant.objet}} ».\n\nAfin de poursuivre l’instruction de votre dossier, il vous est demandé de nous faire parvenir les pièces complémentaires nécessaires dans les meilleurs délais.',
    }),
    idLettre({
      libelle: 'Request for additional documents',
      langue: 'en',
      typesCourrier: ['DEMANDE', 'RECLAMATION'],
      objet: 'Additional documents required — file {{entrant.numero}}',
      corps:
        'Further to your letter {{entrant.numero}} dated {{entrant.dateCourrier}} regarding "{{entrant.objet}}".\n\nIn order to proceed with your file, please send us the required additional documents at your earliest convenience.',
    }),
    idLettre({
      libelle: 'Transmission de facture réglée',
      langue: 'fr',
      typesCourrier: ['FACTURE'],
      objet: 'Règlement de votre facture {{entrant.numero}}',
      corps:
        'Nous vous informons que votre facture référencée {{entrant.numero}}, reçue le {{entrant.dateCourrier}}, a été traitée et réglée par nos services.\n\nVeuillez trouver ci-joint les éléments justificatifs.',
    }),
    idLettre({
      libelle: 'Invoice payment notice',
      langue: 'en',
      typesCourrier: ['FACTURE'],
      objet: 'Payment of your invoice {{entrant.numero}}',
      corps:
        'We are pleased to inform you that your invoice referenced {{entrant.numero}}, received on {{entrant.dateCourrier}}, has been processed and paid by our services.\n\nPlease find the supporting documents enclosed.',
    }),
  ];

  const couleurPrimaire = '#1d4ed8';
  const logoPng = typeof document !== 'undefined' ? genererLogoMonogramme('GSI', couleurPrimaire) : undefined;

  await db.transaction(
    'rw',
    [db.entites, db.postes, db.personnes, db.correspondants, db.modelesCircuit, db.modelesLettre, db.parametres],
    async () => {
      await db.entites.bulkAdd(entites);
      await db.postes.bulkAdd(postes);
      await db.personnes.bulkAdd(personnes);
      await db.correspondants.bulkAdd(correspondants);
      await db.modelesCircuit.bulkAdd(modelesCircuit);
      await db.modelesLettre.bulkAdd(modelesLettre);
      await db.parametres.add({
        id: 'global',
        nomOrganisation: 'Groupe Sanaga Industries',
        sigle: 'GSI',
        adresse: 'Avenue de l’Indépendance, BP 4021, Yaoundé',
        telephone: '+237 222 00 00 00',
        email: 'contact@sanaga-industries.cm',
        logoPng,
        couleurPrimaire,
        langue: 'fr',
        delaiEscaladeJours: 2,
        modeDemo: true,
        decalageHorlogeMinutes: 0,
      });
    },
  );
}

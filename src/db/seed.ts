import { db } from '@/db/db';
import { uid } from '@/services/crypto';
import { chargerLogoOfficiel, genererLogoMonogramme } from '@/db/logo';
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
  return `${partie(prenom)}.${partie(nom)}@fecafoot.demo`;
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

  // Organigramme officiel de la FECAFOOT (fecafoot-officiel.com, « Organisation
  // administrative et technique ») : Présidence avec Cabinet et Contrôle de
  // gestion, Secrétariat général et ses directions / départements, Direction
  // technique nationale et Coordination générale des sélections nationales.
  // Les départements du Secrétariat général sont typés DIRECTION : leur chef
  // valide les dossiers de ses unités (étape « Validation du directeur »).
  const pres = idEntite({ code: 'PRES', libelle: 'Présidence de la FECAFOOT', type: 'DIRECTION', parentId: null });
  const cab = idEntite({ code: 'CAB', libelle: 'Cabinet du Président', type: 'DEPARTEMENT', parentId: pres.id });
  const cdg = idEntite({ code: 'CDG', libelle: 'Contrôle de gestion', type: 'SERVICE', parentId: pres.id });
  const sg = idEntite({ code: 'SG', libelle: 'Secrétariat général', type: 'DEPARTEMENT', parentId: pres.id });
  const daf = idEntite({
    code: 'DAF',
    libelle: 'Direction administrative et financière',
    type: 'DIRECTION',
    parentId: sg.id,
  });
  const rh = idEntite({ code: 'URH', libelle: 'Unité ressources humaines', type: 'SERVICE', parentId: daf.id });
  const cpt = idEntite({ code: 'UCPT', libelle: 'Unité comptabilité', type: 'SERVICE', parentId: daf.id });
  const tre = idEntite({ code: 'UTR', libelle: 'Unité trésorerie et recouvrement', type: 'SERVICE', parentId: daf.id });
  const ach = idEntite({ code: 'UACH', libelle: 'Unité achats', type: 'SERVICE', parentId: daf.id });
  const dcomp = idEntite({ code: 'DCOMP', libelle: 'Département des compétitions', type: 'DIRECTION', parentId: sg.id });
  const ucni = idEntite({ code: 'UCNI', libelle: 'Unité compétitions nationales et internationales', type: 'SERVICE', parentId: dcomp.id });
  const trf = idEntite({ code: 'UTRF', libelle: 'Unité transferts', type: 'SERVICE', parentId: dcomp.id });
  const lic = idEntite({ code: 'ULIC', libelle: 'Unité licences', type: 'SERVICE', parentId: dcomp.id });
  const med = idEntite({ code: 'UMED', libelle: 'Unité médecine sportive', type: 'SERVICE', parentId: dcomp.id });
  const sec = idEntite({ code: 'USEC', libelle: 'Unité sécurité', type: 'SERVICE', parentId: dcomp.id });
  const arb = idEntite({ code: 'DARB', libelle: 'Département arbitrage', type: 'DIRECTION', parentId: sg.id });
  const jur = idEntite({ code: 'DJUR', libelle: 'Département juridique', type: 'DIRECTION', parentId: sg.id });
  const com = idEntite({ code: 'DCOM', libelle: 'Département communication', type: 'DIRECTION', parentId: sg.id });
  const mkt = idEntite({ code: 'DMKT', libelle: 'Département marketing et RSE', type: 'DIRECTION', parentId: sg.id });
  const usi = idEntite({ code: 'USI', libelle: 'Unité système d’information', type: 'SERVICE', parentId: sg.id });
  const bo = idEntite({ code: 'UTDA', libelle: 'Unité traduction, documentation et archives', type: 'SERVICE', parentId: sg.id });
  const dtn = idEntite({ code: 'DTN', libelle: 'Direction technique nationale', type: 'DIRECTION', parentId: pres.id });
  const ufr = idEntite({ code: 'UFR', libelle: 'Unité formation et recherche', type: 'SERVICE', parentId: dtn.id });
  const uoe = idEntite({ code: 'UOE', libelle: 'Unité observation, évaluation et relations avec les sélections', type: 'SERVICE', parentId: dtn.id });
  const ufs = idEntite({ code: 'UFS', libelle: 'Unité football spécialisé', type: 'SERVICE', parentId: dtn.id });
  const cgsn = idEntite({ code: 'CGSN', libelle: 'Coordination générale des sélections nationales', type: 'DIRECTION', parentId: pres.id });

  const entites: Entite[] = [
    pres, cab, cdg, sg,
    daf, rh, cpt, tre, ach,
    dcomp, ucni, trf, lic, med, sec,
    arb, jur, com, mkt, usi, bo,
    dtn, ufr, uoe, ufs,
    cgsn,
  ];

  const idPoste = (partiel: Omit<Poste, 'id' | 'actif'>): Poste => ({
    ...partiel,
    id: uid(),
    actif: true,
  });
  const responsable = (libelle: string, entiteId: ID, role: Poste['role'], peutSigner = false): Poste =>
    idPoste({ libelle, entiteId, role, estResponsable: true, peutSigner });
  const agent = (libelle: string, entiteId: ID, role: Poste['role'] = 'AGENT'): Poste =>
    idPoste({ libelle, entiteId, role, estResponsable: false, peutSigner: false });

  // Postes utilisés par les circuits et les scénarios de démonstration.
  const postePresident = responsable('Président de la FECAFOOT', pres.id, 'DG', true);
  const posteAssistantePres = agent('Assistante de direction', cab.id);
  const posteSG = responsable('Secrétaire général', sg.id, 'DIRECTEUR');
  const posteAccueil = agent('Chargée d’accueil', sg.id, 'ACCUEIL');
  const posteAdmin = agent('Administrateur fonctionnel', usi.id, 'ADMIN');
  const posteChefBO = responsable('Chargé de la traduction, de la documentation et des archives', bo.id, 'BUREAU_ORDRE');
  const posteAgentBO = agent('Assistant courrier et liaisons', bo.id, 'BUREAU_ORDRE');
  const posteDAF = responsable('Directeur administratif et financier', daf.id, 'DIRECTEUR', true);
  const posteChefRH = responsable('Chargé des ressources humaines', rh.id, 'CHEF');
  const posteChefCPT = responsable('Chargé de la comptabilité', cpt.id, 'CHEF');
  const posteComptable = agent('Assistant comptable', cpt.id);
  const posteChefDCOMP = responsable('Chef du département des compétitions', dcomp.id, 'DIRECTEUR', true);
  const posteChefLIC = responsable('Chargé des licences', lic.id, 'CHEF');
  const posteAssistantLIC = agent('Assistant licences', lic.id);

  // Autres postes de l'organigramme (un responsable par entité).
  const autresPostes: Poste[] = [
    responsable('Directeur de cabinet', cab.id, 'DIRECTEUR'),
    agent('Chargé du protocole', cab.id),
    responsable('Contrôleur de gestion', cdg.id, 'CHEF'),
    responsable('Chargé de la trésorerie et du recouvrement', tre.id, 'CHEF'),
    responsable('Chargé des achats', ach.id, 'CHEF'),
    responsable('Chargé des compétitions nationales et internationales', ucni.id, 'CHEF'),
    responsable('Chargé des transferts', trf.id, 'CHEF'),
    responsable('Officier médecine sportive', med.id, 'CHEF'),
    responsable('Officier sécurité', sec.id, 'CHEF'),
    responsable('Chef du département arbitrage', arb.id, 'DIRECTEUR'),
    responsable('Chef du département juridique', jur.id, 'DIRECTEUR'),
    responsable('Chef du département communication', com.id, 'DIRECTEUR'),
    responsable('Chef du département marketing et RSE', mkt.id, 'DIRECTEUR'),
    responsable('Chargé du système d’information', usi.id, 'CHEF'),
    responsable('Directeur technique national', dtn.id, 'DIRECTEUR'),
    agent('Directeur technique national adjoint', dtn.id),
    responsable('Chargé de la formation et de la recherche', ufr.id, 'CHEF'),
    responsable('Chargé de l’observation et de l’évaluation', uoe.id, 'CHEF'),
    responsable('Chargé du football spécialisé', ufs.id, 'CHEF'),
    responsable('Coordonnateur général des sélections nationales', cgsn.id, 'DIRECTEUR'),
    agent('Team manager', cgsn.id),
  ];

  const postes: Poste[] = [
    postePresident,
    posteSG,
    posteAdmin,
    posteAccueil,
    posteAgentBO,
    posteChefBO,
    posteDAF,
    posteChefCPT,
    posteComptable,
    posteChefRH,
    posteChefDCOMP,
    posteChefLIC,
    posteAssistantLIC,
    posteAssistantePres,
    ...autresPostes,
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

  const posteAutre = (libelle: string): ID => autresPostes.find((p) => p.libelle === libelle)!.id;

  // Le Président est le président réel de la FECAFOOT (réélu le 29 novembre 2025) ;
  // les autres personnes sont fictives.
  const personnes: Personne[] = [
    idPersonne('Samuel', 'Eto’o Fils', postePresident.id),
    idPersonne('Aïcha', 'Bello', posteSG.id),
    idPersonne('Admin', 'POC', posteAdmin.id),
    idPersonne('Mireille', 'Ondoa', posteAccueil.id),
    idPersonne('Carine', 'Ngo Bassong', posteAgentBO.id),
    idPersonne('Ernest', 'Fouda', posteChefBO.id),
    idPersonne('Samuel', 'Tchoupo', posteDAF.id),
    idPersonne('Grâce', 'Eyenga', posteChefCPT.id, [posteChefRH.id]),
    idPersonne('Idriss', 'Moussa', posteComptable.id),
    idPersonne('Brenda', 'Nkeng', posteChefRH.id),
    idPersonne('Hervé', 'Kamga', posteChefDCOMP.id),
    idPersonne('Josiane', 'Atangana', posteChefLIC.id),
    idPersonne('Rodrigue', 'Essomba', posteAssistantLIC.id),
    idPersonne('Nadège', 'Owona', posteAssistantePres.id),
    idPersonne('Richard', 'Nana', posteAutre('Directeur de cabinet')),
    idPersonne('Estelle', 'Abada', posteAutre('Contrôleur de gestion')),
    idPersonne('Luc', 'Mvondo', posteAutre('Directeur technique national')),
    idPersonne('Martin', 'Ekani', posteAutre('Coordonnateur général des sélections nationales')),
    idPersonne('Béatrice', 'Ngono', posteAutre('Chef du département arbitrage')),
    idPersonne('Solange', 'Mengue', posteAutre('Chef du département juridique')),
    idPersonne('Yannick', 'Tchana', posteAutre('Chef du département communication')),
    idPersonne('Clarisse', 'Mballa', posteAutre('Chef du département marketing et RSE')),
    idPersonne('Franck', 'Nguele', posteAutre('Chargé du système d’information')),
    idPersonne('Joël', 'Biyong', posteAutre('Chargé du protocole')),
    idPersonne('Sandrine', 'Fotso', posteAutre('Chargé de la trésorerie et du recouvrement')),
    idPersonne('Alain', 'Ndzana', posteAutre('Chargé des achats')),
    idPersonne('Patrice', 'Oyono', posteAutre('Chargé des compétitions nationales et internationales')),
    idPersonne('Carole', 'Ebongue', posteAutre('Chargé des transferts')),
    idPersonne('Emmanuel', 'Njoya', posteAutre('Officier médecine sportive')),
    idPersonne('Gaston', 'Mbida', posteAutre('Officier sécurité')),
    idPersonne('Bertrand', 'Zang', posteAutre('Directeur technique national adjoint')),
    idPersonne('Hélène', 'Manga', posteAutre('Chargé de la formation et de la recherche')),
    idPersonne('Thomas', 'Ayissi', posteAutre('Chargé de l’observation et de l’évaluation')),
    idPersonne('Rose', 'Nkolo', posteAutre('Chargé du football spécialisé')),
    idPersonne('Christian', 'Belinga', posteAutre('Team manager')),
  ];

  const idCorrespondant = (partiel: Omit<Correspondant, 'id'>): Correspondant => ({
    ...partiel,
    id: uid(),
  });

  const correspondants: Correspondant[] = [
    idCorrespondant({ nom: 'Ministère des Sports et de l’Éducation physique', categorie: 'ADMINISTRATION', adresse: 'Yaoundé' }),
    idCorrespondant({ nom: 'Confédération africaine de football (CAF)', categorie: 'ADMINISTRATION', adresse: 'Le Caire, Égypte' }),
    idCorrespondant({ nom: 'FIFA', organisation: 'Fédération internationale de football association', categorie: 'ADMINISTRATION', adresse: 'Zurich, Suisse' }),
    idCorrespondant({ nom: 'Ligue de football professionnel du Cameroun', categorie: 'ADMINISTRATION', adresse: 'Yaoundé' }),
    idCorrespondant({ nom: 'Ligue régionale de football du Centre', categorie: 'ADMINISTRATION', adresse: 'Yaoundé' }),
    idCorrespondant({ nom: 'Ligue régionale de football du Littoral', categorie: 'ADMINISTRATION', adresse: 'Douala' }),
    idCorrespondant({ nom: 'Canon Sportif de Yaoundé', categorie: 'ENTREPRISE', adresse: 'Yaoundé' }),
    idCorrespondant({ nom: 'Coton Sport FC de Garoua', categorie: 'ENTREPRISE', adresse: 'Garoua' }),
    idCorrespondant({ nom: 'Union Sportive de Douala', categorie: 'ENTREPRISE', adresse: 'Douala' }),
    idCorrespondant({ nom: 'Banque Atlantique Centrale', categorie: 'ENTREPRISE', adresse: 'Boulevard du 20 Mai, Yaoundé', telephone: '+237 233 42 10 10', email: 'contact@banque-atlantique-centrale.example' }),
    idCorrespondant({ nom: 'Transports Nkolbisson SARL', categorie: 'ENTREPRISE', adresse: 'Zone industrielle de Nkolbisson', telephone: '+237 677 12 34 56' }),
    idCorrespondant({ nom: 'Cabinet Ekambi & Associés', organisation: 'Cabinet Ekambi & Associés', categorie: 'ENTREPRISE', adresse: 'Immeuble Ekambi, Bastos, Yaoundé', email: 'cabinet@ekambi-associes.example' }),
    idCorrespondant({ nom: 'Bureautique Plus', categorie: 'ENTREPRISE', adresse: 'Avenue Kennedy, Yaoundé', telephone: '+237 699 88 77 66' }),
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
        etape({ ordre: 3, type: 'SIGNATURE', libelle: 'Signature du Président', posteCibleId: postePresident.id, delaiJours: 2, sauterSiRedacteur: false }),
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

  const couleurPrimaire = '#007a3d';
  const logoPng =
    typeof document !== 'undefined'
      ? ((await chargerLogoOfficiel()) ?? genererLogoMonogramme('FCF', couleurPrimaire))
      : undefined;

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
        nomOrganisation: 'Fédération Camerounaise de Football',
        sigle: 'FECAFOOT',
        adresse: 'Tsinga, Yaoundé',
        telephone: '+237 222 20 19 28',
        email: 'contact@fecafoot-officiel.com',
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

/**
 * Bases initialisées avant l'ajout de `public/logo.png` : remplace le monogramme
 * généré (ou l'absence de logo) par le logo officiel. Un logo importé via la
 * personnalisation est conservé.
 */
export async function migrerLogoOfficiel(): Promise<void> {
  const parametres = await db.parametres.get('global');
  if (!parametres) return;
  const estMonogramme =
    !parametres.logoPng || parametres.logoPng === genererLogoMonogramme('FCF', parametres.couleurPrimaire);
  if (!estMonogramme) return;
  const logoPng = await chargerLogoOfficiel();
  if (logoPng && logoPng !== parametres.logoPng) await db.parametres.update('global', { logoPng });
}

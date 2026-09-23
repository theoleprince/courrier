import Dexie, { type EntityTable } from 'dexie';
import type {
  Entite,
  Poste,
  Personne,
  Correspondant,
  Courrier,
  PieceJointe,
  ModeleCircuit,
  CircuitInstance,
  Diffusion,
  Notification,
  ModeleLettre,
  Historique,
  Signature,
  Parametres,
  Sequence,
} from '@/types/models';

export class GestionCourrierDB extends Dexie {
  entites!: EntityTable<Entite, 'id'>;
  postes!: EntityTable<Poste, 'id'>;
  personnes!: EntityTable<Personne, 'id'>;
  correspondants!: EntityTable<Correspondant, 'id'>;
  courriers!: EntityTable<Courrier, 'id'>;
  piecesJointes!: EntityTable<PieceJointe, 'id'>;
  modelesCircuit!: EntityTable<ModeleCircuit, 'id'>;
  circuits!: EntityTable<CircuitInstance, 'id'>;
  diffusions!: EntityTable<Diffusion, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  modelesLettre!: EntityTable<ModeleLettre, 'id'>;
  historique!: EntityTable<Historique, 'id'>;
  signatures!: EntityTable<Signature, 'id'>;
  parametres!: EntityTable<Parametres, 'id'>;
  sequences!: EntityTable<Sequence, 'id'>;

  constructor() {
    super('gestion-courrier');
    this.version(1).stores({
      entites: 'id, parentId, type',
      postes: 'id, entiteId, role',
      personnes: 'id, posteId, *interimPosteIds, email',
      correspondants: 'id, nom, telephone, email',
      // `numero` n'est pas un index unique : il vaut `null` pour tous les brouillons
      // et Dexie appliquerait l'unicité à la valeur `null` elle-même. L'unicité réelle
      // est garantie par la séquence (services/workflow.ts). Voir DECISIONS.md.
      courriers:
        'id, sens, numero, &codeSuivi, statut, [sens+statut], entiteTraitanteId, correspondantId, reponseAId, creeLe',
      piecesJointes: 'id, courrierId, [courrierId+nature]',
      modelesCircuit: 'id, sens',
      circuits: 'id, courrierId, posteCourantId, statut',
      diffusions: 'id, courrierId, posteId',
      notifications: 'id, posteId, courrierId, &cle, creeLe',
      modelesLettre: 'id',
      historique: 'id, &sequence, courrierId, date',
      signatures: 'id, courrierId',
      parametres: 'id',
      sequences: 'id',
    });
  }
}

export const db = new GestionCourrierDB();

// Base supprimée depuis un autre onglet (réinitialisation de la démo) : on recharge
// cet onglet pour qu'il reparte sur la nouvelle base au lieu de rester sur une connexion fermée.
db.on('versionchange', (evenement) => {
  if (evenement.newVersion === null) {
    db.close();
    window.location.reload();
    return false;
  }
});

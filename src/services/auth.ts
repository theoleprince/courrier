import { db } from '@/db/db';
import type { Personne } from '@/types/models';

export const MOT_DE_PASSE_DEFAUT = '123456789';

/**
 * Authentification "classique" par identifiant + mot de passe, en plus de la
 * connexion par clic dans l'organigramme (section 6.2). Mot de passe en clair
 * comparé tel quel : c'est un POC hors ligne sans back-end, cette voie
 * d'authentification n'a donc aucune valeur de sécurité réelle — au même
 * titre que le reste de l'authentification, explicitement exclue du
 * périmètre sécurisé (section 2 / 20.4). Le mot de passe détermine
 * uniquement quelle personne (et donc quel nœud de l'organigramme) se
 * connecte, comme le ferait un clic sur son nom.
 */
export async function authentifier(identifiant: string, motDePasse: string): Promise<Personne | null> {
  const valeur = identifiant.trim().toLowerCase();
  if (!valeur || !motDePasse) return null;

  const personnes = await db.personnes.toArray();
  const personne = personnes.find(
    (p) => p.actif && (p.email.toLowerCase() === valeur || `${p.prenom} ${p.nom}`.toLowerCase() === valeur),
  );
  if (!personne) return null;

  const attendu = personne.motDePasse ?? MOT_DE_PASSE_DEFAUT;
  return motDePasse === attendu ? personne : null;
}

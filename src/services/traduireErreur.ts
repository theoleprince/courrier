import i18n from '@/i18n';
import { ErreurWorkflow } from '@/services/erreurs';

/** Traduit une ErreurWorkflow (message i18n affichable tel quel) ou toute autre erreur en texte utilisateur. */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurWorkflow) {
    return i18n.t(erreur.cle, erreur.params ?? {});
  }
  if (erreur instanceof Error) return erreur.message;
  return i18n.t('erreurs.inconnue');
}

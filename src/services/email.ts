import { db } from '@/db/db';
import { origineApp } from '@/services/urls';
import type { CourrierSortant } from '@/types/models';

/**
 * Envoi réel des courriers expédiés par e-mail, via EmailJS (https://www.emailjs.com) :
 * l'application n'a pas de serveur, EmailJS accepte un envoi depuis le navigateur avec
 * une clé *publique* (restreinte aux domaines autorisés dans le compte EmailJS).
 * Les identifiants peuvent être remplacés au build par des variables VITE_EMAILJS_*.
 */
const CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID ?? 'service_c6ouvu7',
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? 'template_wcb07qs',
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? 'yUWLiuikrQz5GLf90',
};

const URL_ENVOI = 'https://api.emailjs.com/api/v1.0/email/send';

/** Variables attendues par le modèle EmailJS ({{destinataire}}, {{objet}}, …). */
export interface ParametresEmail {
  destinataire: string;
  objet: string;
  numero: string;
  date: string;
  message: string;
  lien_verification: string;
  organisation: string;
}

/** Construit le contenu de l'e-mail d'un courrier expédié : lien de vérification de sa dernière signature. */
export async function parametresEmailExpedition(sortant: CourrierSortant): Promise<ParametresEmail> {
  const [parametres, signatures] = await Promise.all([
    db.parametres.get('global'),
    db.signatures.where('courrierId').equals(sortant.id).toArray(),
  ]);
  const derniere = signatures.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return {
    destinataire: sortant.emailDestinataire ?? '',
    objet: sortant.objet,
    numero: sortant.numero ?? sortant.codeSuivi,
    date: new Date(sortant.dateExpedition ?? sortant.misAJourLe).toLocaleDateString('fr-FR'),
    message: 'Le document original signé est conservé dans nos services.',
    lien_verification: derniere ? `${origineApp()}/verifier/${derniere.id}` : `${origineApp()}/portail`,
    organisation: parametres?.nomOrganisation ?? '',
  };
}

/** Envoie l'e-mail ; lève une erreur lisible si EmailJS refuse (quota, domaine non autorisé…). */
export async function envoyerEmail(parametres: ParametresEmail): Promise<void> {
  const reponse = await fetch(URL_ENVOI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: CONFIG.serviceId,
      template_id: CONFIG.templateId,
      user_id: CONFIG.publicKey,
      template_params: parametres,
    }),
  });
  if (!reponse.ok) {
    throw new Error(`EmailJS ${reponse.status} : ${(await reponse.text()).slice(0, 200)}`);
  }
}

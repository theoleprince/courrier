import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { obtenirFicheSuivi } from '@/services/suivi';
import { genererRecepisse } from '@/services/documents';
import { ouvrirPdf } from '@/services/impression';
import { toastSucces } from '@/store/toasts';
import { BadgeStatut } from '@/components/courrier/Badges';
import { TimelineParcours } from '@/components/courrier/TimelineParcours';
import { Button } from '@/components/ui/Button';
import type { CourrierEntrant } from '@/types/models';

export function Suivi(): React.JSX.Element {
  const { code } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const navigate = useNavigate();
  const acteur = useActeur();
  const parametres = useParametres();

  const fiche = useLiveQuery(async () => (acteur && code ? obtenirFicheSuivi(code, acteur) : undefined), [code, acteur?.poste.id]);
  const correspondant = useLiveQuery(
    () => (fiche ? db.correspondants.get(fiche.courrier.correspondantId) : undefined),
    [fiche?.courrier.correspondantId],
  );

  if (fiche === undefined) return <p>{t('commun.chargement')}</p>;
  if (!fiche) return <p className="text-slate-500">{t('suivi.codeIntrouvable')}</p>;

  const { courrier, statut, detenteur, dateReponseEstimee, dateLimiteReponse, enRetard, echeanceActuelle, parcours, niveau } = fiche;
  const joursRetard = echeanceActuelle ? Math.ceil((Date.now() - new Date(echeanceActuelle).getTime()) / 86_400_000) : 0;

  async function copierMessage() {
    const texte = `Votre courrier ${courrier.numero ?? courrier.codeSuivi} est ${t(statut.cle, statut.params).toLowerCase()}${
      dateReponseEstimee ? `. Réponse estimée avant le ${format(new Date(dateReponseEstimee), 'P', { locale })}` : ''
    }.`;
    await navigator.clipboard.writeText(texte);
    toastSucces(t('suivi.messageCopie'));
  }

  async function reimprimerRecepisse() {
    if (!parametres || courrier.sens !== 'ENTRANT' || !correspondant) return;
    const entrant = courrier as CourrierEntrant;
    const blob = await genererRecepisse({
      courrier: entrant,
      correspondant,
      parametres,
      nombrePages: 1,
      urlPortail: `${window.location.origin}/portail?code=${entrant.codeSuivi}`,
      dateAffichee: format(new Date(entrant.dateReception), 'Pp', { locale }),
    });
    ouvrirPdf(blob);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 rounded-lg border border-slate-200 p-6 dark:border-slate-700">
        <BadgeStatut statut={statut} />
        <h1 className="mt-3 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {courrier.numero ?? courrier.codeSuivi}
        </h1>
        {detenteur && (
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            {t('suivi.actuellementA', { entite: detenteur.entite ?? '—', poste: detenteur.poste ?? '—' })}
            {enRetard && <span className="ml-2 font-medium text-red-500">{t('suivi.enRetardDe', { jours: joursRetard })}</span>}
          </p>
        )}
        {courrier.sens === 'ENTRANT' && (courrier as CourrierEntrant).reponseAttendue && dateReponseEstimee && (
          <p className="mt-2 text-sm text-slate-500">
            {dateLimiteReponse
              ? t('suivi.reponseAttendueAvant', { date: format(new Date(dateLimiteReponse), 'P', { locale }) })
              : t('suivi.reponseEstimee', { date: format(new Date(dateReponseEstimee), 'P', { locale }) })}
          </p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {courrier.sens === 'ENTRANT' && (
          <Button variante="secondaire" onClick={reimprimerRecepisse}>
            {t('suivi.reimprimerRecepisse')}
          </Button>
        )}
        <Button variante="secondaire" onClick={copierMessage}>
          {t('suivi.copierMessage')}
        </Button>
        {niveau === 'COMPLET' && (
          <Button variante="discret" onClick={() => navigate(`/courriers/${courrier.id}`)}>
            {t('suivi.voirDetailComplet')}
          </Button>
        )}
      </div>

      {parcours.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-6 dark:border-slate-700">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('suivi.parcours')}</h2>
          <TimelineParcours etapes={parcours} />
        </div>
      )}
    </div>
  );
}

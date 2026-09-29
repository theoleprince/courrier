import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { rechercherSuiviPublic, type FicheSuiviPublique } from '@/services/suivi';
import { db } from '@/db/db';
import { tracer, ACTEUR_SYSTEME } from '@/services/journal';
import { BadgeStatut } from '@/components/courrier/Badges';
import { Button } from '@/components/ui/Button';

/**
 * Consultation publique de l'état d'un courrier : code de suivi (du dépôt ou de la
 * réponse) + 3 premières lettres du nom du correspondant. Utilisé par le portail et
 * par la page de vérification ouverte depuis l'e-mail de réponse.
 */
export function SuiviPublic({ codeInitial = '', origine }: { codeInitial?: string; origine: string }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const [codeSuivi, setCodeSuivi] = useState(codeInitial);
  const [identifiant, setIdentifiant] = useState('');
  const [resultat, setResultat] = useState<FicheSuiviPublique | null | undefined>(undefined);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const trouve = await rechercherSuiviPublic(codeSuivi, identifiant);
    setResultat(trouve);
    if (trouve) {
      const courrier = await db.courriers.where('codeSuivi').equals(codeSuivi.trim().toUpperCase()).first();
      if (courrier) {
        await db.transaction('rw', db.tables, () =>
          tracer({
            courrierId: courrier.id,
            action: 'CONSULTATION_SUIVI',
            acteurId: ACTEUR_SYSTEME,
            posteId: ACTEUR_SYSTEME,
            details: { origine },
          }),
        );
      }
    }
  }

  return (
    <div>
      <form onSubmit={verifier} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('portail.codeSuivi')}</span>
          <input className="champ uppercase" value={codeSuivi} onChange={(e) => setCodeSuivi(e.target.value)} placeholder="XXXX-XXXX" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('portail.identifiant')}</span>
          <input className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
        </label>
        <Button type="submit" variante="primaire" className="w-full justify-center">
          {t('portail.verifier')}
        </Button>
      </form>

      {resultat === null && <p className="mt-4 text-sm text-red-500">{t('portail.introuvable')}</p>}

      {resultat && (
        <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <BadgeStatut statut={resultat.statut} />
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{resultat.numero ?? resultat.codeSuivi}</p>
          {resultat.objet && <p className="text-sm text-slate-600 dark:text-slate-300">{resultat.objet}</p>}
          {resultat.entiteDetentrice && <p className="text-sm text-slate-500 dark:text-slate-400">{resultat.entiteDetentrice}</p>}
          {resultat.dateReponseEstimee && (
            <p className="text-sm text-slate-500">
              {t('suivi.reponseEstimee', { date: format(new Date(resultat.dateReponseEstimee), 'P', { locale }) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { corbeille, objetAffiche } from '@/services/requetes';
import { tachesConfieesA } from '@/services/taches';
import { TableTaches } from '@/components/courrier/TableTaches';

export function Corbeille(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const navigate = useNavigate();
  const acteur = useActeur();
  const taches = useLiveQuery(() => (acteur ? corbeille(acteur.poste.id) : []), [acteur?.poste.id]) ?? [];
  const confiees = useLiveQuery(() => (acteur ? tachesConfieesA(acteur.poste.id) : []), [acteur?.poste.id]) ?? [];
  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('corbeille.titre')}</h1>

      {confiees.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('taches.confieesAMoi')}</h2>
          <ul className="space-y-2">
            {confiees.map(({ tache, courrier }) => {
              const enRetard = !!tache.echeance && new Date(tache.echeance) < new Date();
              return (
                <li key={tache.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/courriers/${courrier.id}`)}
                    className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-[var(--couleur-primaire)] dark:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {courrier.numero ?? courrier.codeSuivi} — {objetAffiche(courrier, 'COMPLET')}
                      </span>
                      {tache.echeance && (
                        <span className={`text-xs ${enRetard ? 'font-medium text-red-500' : 'text-slate-400'}`}>
                          {format(new Date(tache.echeance), 'P', { locale })}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{postes.find((p) => p.id === tache.posteSourceId)?.libelle}</span> : « {tache.note} »
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <TableTaches taches={taches} videMessage={confiees.length > 0 ? '' : t('corbeille.vide')} />
    </div>
  );
}

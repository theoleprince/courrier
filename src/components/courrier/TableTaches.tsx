import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { db } from '@/db/db';
import { objetAffiche } from '@/services/requetes';
import { BadgePriorite } from '@/components/courrier/Badges';
import type { TacheCorbeille } from '@/services/requetes';

export function TableTaches({ taches, videMessage }: { taches: TacheCorbeille[]; videMessage: string }): React.JSX.Element {
  const { t } = useTranslation();

  if (taches.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{videMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">{t('courrier.objet')}</th>
            <th className="px-3 py-2">{t('courrier.correspondant')}</th>
            <th className="px-3 py-2">Étape</th>
            <th className="px-3 py-2"></th>
            <th className="px-3 py-2">{t('corbeille.echeance')}</th>
          </tr>
        </thead>
        <tbody>
          {taches.map((tache) => (
            <LigneTache key={tache.circuit.id} tache={tache} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LigneTache({ tache }: { tache: TacheCorbeille }): React.JSX.Element {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const correspondant = useLiveQuery(
    () => db.correspondants.get(tache.courrier.correspondantId),
    [tache.courrier.correspondantId],
  );
  const enRetard = !!tache.etape.echeance && new Date(tache.etape.echeance) < new Date();

  return (
    <tr
      onClick={() => navigate(`/courriers/${tache.courrier.id}`)}
      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
    >
      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
        {tache.courrier.numero ?? tache.courrier.codeSuivi}
      </td>
      <td className="max-w-xs truncate px-3 py-2">{objetAffiche(tache.courrier, 'COMPLET')}</td>
      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{correspondant?.nom}</td>
      <td className="px-3 py-2">{tache.etape.libelle}</td>
      <td className="px-3 py-2">
        <BadgePriorite priorite={tache.courrier.priorite} />
      </td>
      <td className={`whitespace-nowrap px-3 py-2 text-xs ${enRetard ? 'font-medium text-red-500' : 'text-slate-400'}`}>
        {tache.etape.echeance && format(new Date(tache.etape.echeance), 'P', { locale })}
      </td>
    </tr>
  );
}

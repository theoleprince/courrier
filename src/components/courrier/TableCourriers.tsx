import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { db } from '@/db/db';
import { useVisibilite } from '@/hooks/useVisibilite';
import { objetAffiche } from '@/services/requetes';
import { statutClair } from '@/services/suivi';
import { maintenant } from '@/services/horloge';
import { BadgeStatut, BadgePriorite } from '@/components/courrier/Badges';
import type { Courrier } from '@/types/models';

interface Props {
  courriers: Courrier[];
  selection?: Set<string>;
  onBasculerSelection?: (id: string) => void;
  /** Affiche la colonne « Réponse attendue avant » (date limite + jours restants). */
  avecDelaiReponse?: boolean;
}

export function TableCourriers({ courriers, selection, onBasculerSelection, avecDelaiReponse }: Props): React.JSX.Element {
  const { t } = useTranslation();

  if (courriers.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t('commun.aucunResultat')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            {onBasculerSelection && <th className="w-8 px-3 py-2"></th>}
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">{t('courrier.objet')}</th>
            <th className="px-3 py-2">{t('courrier.correspondant')}</th>
            <th className="px-3 py-2">{t('tableauDeBord.titre')}</th>
            <th className="px-3 py-2"></th>
            {avecDelaiReponse && <th className="px-3 py-2">{t('reponsesAttendues.delai')}</th>}
            <th className="px-3 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {courriers.map((courrier) => (
            <LigneCourrier
              key={courrier.id}
              courrier={courrier}
              selectionne={selection?.has(courrier.id)}
              onBasculerSelection={onBasculerSelection}
              avecDelaiReponse={avecDelaiReponse}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LigneCourrier({
  courrier,
  selectionne,
  onBasculerSelection,
  avecDelaiReponse,
}: {
  courrier: Courrier;
  selectionne?: boolean;
  onBasculerSelection?: (id: string) => void;
  avecDelaiReponse?: boolean;
}): React.JSX.Element | null {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const niveau = useVisibilite(courrier);
  const statut = useLiveQuery(() => statutClair(courrier), [courrier.id, courrier.statut]);
  const correspondant = useLiveQuery(() => db.correspondants.get(courrier.correspondantId), [courrier.correspondantId]);

  if (niveau === 'AUCUN') return null;

  return (
    <tr
      onClick={() => (onBasculerSelection ? onBasculerSelection(courrier.id) : navigate(`/courriers/${courrier.id}`))}
      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
    >
      {onBasculerSelection && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={!!selectionne} onChange={() => onBasculerSelection(courrier.id)} />
        </td>
      )}
      <td
        className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200"
        onClick={(e) => {
          if (onBasculerSelection) {
            e.stopPropagation();
            navigate(`/courriers/${courrier.id}`);
          }
        }}
      >
        {courrier.numero ?? courrier.codeSuivi}
      </td>
      <td className="max-w-xs truncate px-3 py-2">{niveau ? objetAffiche(courrier, niveau) : ''}</td>
      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{niveau === 'MINIMAL' ? '—' : correspondant?.nom}</td>
      <td className="px-3 py-2">{statut && <BadgeStatut statut={statut} />}</td>
      <td className="px-3 py-2">
        <BadgePriorite priorite={courrier.priorite} />
      </td>
      {avecDelaiReponse && (
        <td className="whitespace-nowrap px-3 py-2">
          <DelaiReponse dateLimite={courrier.sens === 'ENTRANT' ? courrier.dateLimiteReponse : undefined} />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
        {format(new Date(courrier.creeLe), 'P', { locale })}
      </td>
    </tr>
  );
}

/** Date limite de réponse et jours restants, en rouge si dépassée, en orange à 2 jours ou moins. */
function DelaiReponse({ dateLimite }: { dateLimite?: string }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  // Relit le décalage de l'horloge de démo pour se recalculer quand on avance le temps.
  useLiveQuery(() => db.parametres.get('global').then((p) => p?.decalageHorlogeMinutes ?? 0));

  if (!dateLimite) return <span className="text-slate-400">—</span>;
  const jours = differenceInCalendarDays(new Date(dateLimite), maintenant());
  const couleur = jours < 0 ? 'text-red-600 dark:text-red-400' : jours <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
  const reste =
    jours < 0
      ? t('suivi.enRetardDe', { jours: -jours })
      : jours === 0
        ? t('reponsesAttendues.aujourdhui')
        : t('reponsesAttendues.joursRestants', { count: jours });

  return (
    <div>
      <p className="text-slate-700 dark:text-slate-200">{format(new Date(dateLimite), 'P', { locale })}</p>
      <p className={`text-xs font-medium ${couleur}`}>{reste}</p>
    </div>
  );
}

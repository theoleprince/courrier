import { useTranslation } from 'react-i18next';
import { formatDistanceStrict, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Check, Clock, X, MinusCircle, AlertTriangle } from 'lucide-react';
import type { EtapeAffichee } from '@/services/suivi';

function IconeEtape({ etape }: { etape: EtapeAffichee }): React.JSX.Element {
  if (etape.statut === 'VALIDEE') return <Check size={14} className="text-white" />;
  if (etape.statut === 'REJETEE') return <X size={14} className="text-white" />;
  if (etape.statut === 'IGNOREE') return <MinusCircle size={14} className="text-white" />;
  if (etape.enRetard) return <AlertTriangle size={14} className="text-white" />;
  if (etape.statut === 'EN_COURS') return <Clock size={14} className="text-white" />;
  return <span className="block h-2 w-2 rounded-full bg-white" />;
}

function couleurPastille(etape: EtapeAffichee): string {
  if (etape.statut === 'VALIDEE') return 'bg-green-600';
  if (etape.statut === 'REJETEE') return 'bg-red-600';
  if (etape.statut === 'IGNOREE') return 'bg-slate-400';
  if (etape.enRetard) return 'bg-red-500';
  if (etape.statut === 'EN_COURS') return 'bg-[var(--couleur-primaire)]';
  return 'bg-slate-300 dark:bg-slate-600';
}

export function TimelineParcours({ etapes }: { etapes: EtapeAffichee[] }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;

  return (
    <ol className="space-y-0">
      {etapes.map((etape, index) => {
        const duree =
          etape.debutLe && etape.finLe ? formatDistanceStrict(new Date(etape.debutLe), new Date(etape.finLe), { locale }) : undefined;
        return (
          <li key={index} className="relative flex gap-3 pb-6 last:pb-0">
            {index < etapes.length - 1 && (
              <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200 dark:bg-slate-700" />
            )}
            <span className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${couleurPastille(etape)}`}>
              <IconeEtape etape={etape} />
            </span>
            <div className={`flex-1 ${etape.statut === 'IGNOREE' ? 'opacity-50' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-slate-800 dark:text-slate-100">{etape.libelle}</span>
                {etape.statut === 'IGNOREE' && (
                  <span className="text-xs text-slate-400">({t('suivi.etapeIgnoree')})</span>
                )}
                {etape.statut === 'REJETEE' && (
                  <span className="text-xs text-red-500">({t('suivi.etapeRejetee')})</span>
                )}
              </div>
              {(etape.entite || etape.poste) && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {[etape.entite, etape.poste, etape.personne].filter(Boolean).join(' — ')}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {etape.debutLe && format(new Date(etape.debutLe), 'Pp', { locale })}
                {duree && ` · ${duree}`}
                {etape.statut === 'EN_COURS' && etape.echeance && (
                  <span className={etape.enRetard ? 'ml-1 font-medium text-red-500' : 'ml-1'}>
                    {' · '}
                    {etape.enRetard
                      ? t('suivi.enRetardDe', {
                          jours: Math.ceil((Date.now() - new Date(etape.echeance).getTime()) / 86_400_000),
                        })
                      : t('suivi.dansLesDelais')}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

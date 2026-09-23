import { useTranslation } from 'react-i18next';
import type { StatutClair } from '@/services/suivi';
import type { Priorite } from '@/types/models';

const couleurStatut: Record<string, string> = {
  'suivi.statut.enregistre': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'suivi.statut.enTraitement': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'suivi.statut.enValidation': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'suivi.statut.reponseEnSignature': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'suivi.statut.reponseEnPreparation': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'suivi.statut.reponseEnvoyee': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  'suivi.statut.traiteLe': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  'suivi.statut.archive': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'suivi.statut.brouillon': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'suivi.statut.rejete': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'suivi.statut.signe': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'suivi.statut.expedieLe': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
};

export function BadgeStatut({ statut }: { statut: StatutClair }): React.JSX.Element {
  const { t } = useTranslation();
  const classes = couleurStatut[statut.cle] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {t(statut.cle, statut.params)}
    </span>
  );
}

export function BadgePriorite({ priorite }: { priorite: Priorite }): React.JSX.Element | null {
  const { t } = useTranslation();
  if (priorite === 'NORMALE') return null;
  const classes =
    priorite === 'TRES_URGENTE'
      ? 'bg-red-600 text-white'
      : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {t(`priorite.${priorite}`)}
    </span>
  );
}

import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useActeur } from '@/hooks/useActeur';
import { corbeille } from '@/services/requetes';
import { TableTaches } from '@/components/courrier/TableTaches';

export function Corbeille(): React.JSX.Element {
  const { t } = useTranslation();
  const acteur = useActeur();
  const taches = useLiveQuery(() => (acteur ? corbeille(acteur.poste.id) : []), [acteur?.poste.id]) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('corbeille.titre')}</h1>
      <TableTaches taches={taches} videMessage={t('corbeille.vide')} />
    </div>
  );
}

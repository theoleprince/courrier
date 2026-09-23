import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { courriersAExpedier } from '@/services/requetes';
import { TableCourriers } from '@/components/courrier/TableCourriers';

export function Expeditions(): React.JSX.Element {
  const { t } = useTranslation();
  const courriers = useLiveQuery(courriersAExpedier) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.aExpedier')}</h1>
      <TableCourriers courriers={courriers} />
    </div>
  );
}

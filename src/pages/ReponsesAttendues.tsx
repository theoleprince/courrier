import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { reponsesAttendues } from '@/services/requetes';
import { TableCourriers } from '@/components/courrier/TableCourriers';

export function ReponsesAttendues(): React.JSX.Element {
  const { t } = useTranslation();
  const courriers = useLiveQuery(reponsesAttendues) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.reponsesAttendues')}</h1>
      <TableCourriers courriers={courriers} avecDelaiReponse />
    </div>
  );
}

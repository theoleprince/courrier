import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

export function Correspondants(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const correspondants = useLiveQuery(() => db.correspondants.orderBy('nom').toArray()) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.correspondants')}</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {correspondants.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/correspondants/${c.id}`)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{c.nom}</td>
                <td className="px-3 py-2 text-slate-500">{c.categorie}</td>
                <td className="px-3 py-2 text-slate-500">{c.telephone}</td>
                <td className="px-3 py-2 text-slate-500">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

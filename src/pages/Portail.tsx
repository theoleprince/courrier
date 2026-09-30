import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { useParametres } from '@/hooks/useParametres';
import { SuiviPublic } from '@/components/courrier/SuiviPublic';

export function Portail(): React.JSX.Element {
  const { t } = useTranslation();
  const parametres = useParametres();
  const [params] = useSearchParams();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
      style={{ background: `linear-gradient(180deg, ${parametres?.couleurPrimaire ?? '#1d4ed8'}10, transparent)` }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          {parametres?.logoPng && <img src={parametres.logoPng} alt="" className="h-10 w-10 object-contain" />}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{parametres?.nomOrganisation}</h1>
            <p className="text-sm text-slate-500">{t('portail.titre')}</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t('portail.sousTitre')}</p>

        <SuiviPublic codeInitial={params.get('code') ?? ''} origine="portail" />

        <Link to="/verifier" className="mt-6 block text-center text-sm text-[var(--couleur-primaire)] hover:underline">
          {t('portail.verifierDocument')}
        </Link>
      </div>
    </div>
  );
}

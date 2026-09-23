import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useActeur } from '@/hooks/useActeur';
import { rechercherGlobal, type ResultatRecherche } from '@/services/recherche';
import { Search } from 'lucide-react';

export function Recherche(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);

  async function surRecherche(valeur: string) {
    setTexte(valeur);
    if (!acteur || valeur.trim().length < 2) {
      setResultats([]);
      return;
    }
    setResultats(await rechercherGlobal(valeur, acteur, 40));
  }

  const courriers = resultats.filter((r): r is Extract<ResultatRecherche, { type: 'courrier' }> => r.type === 'courrier');
  const correspondants = resultats.filter((r): r is Extract<ResultatRecherche, { type: 'correspondant' }> => r.type === 'correspondant');

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('recherche.titre')}</h1>
      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          autoFocus
          value={texte}
          onChange={(e) => surRecherche(e.target.value)}
          placeholder={t('recherche.placeholder') ?? undefined}
          className="champ pl-10"
        />
      </div>

      {texte.trim().length >= 2 && resultats.length === 0 && <p className="text-sm text-slate-400">{t('recherche.aucunResultat')}</p>}

      {courriers.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('recherche.courriers')}</h2>
          <ul className="space-y-1">
            {courriers.map((r) => (
              <li key={r.courrier.id}>
                <button
                  type="button"
                  onClick={() => navigate(r.courrier.codeSuivi ? `/suivi/${r.courrier.codeSuivi}` : `/courriers/${r.courrier.id}`)}
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:border-[var(--couleur-primaire)] dark:border-slate-700"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{r.courrier.numero ?? r.courrier.codeSuivi}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">{r.objetAffiche}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {correspondants.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('recherche.correspondants')}</h2>
          <ul className="space-y-1">
            {correspondants.map((r) => (
              <li key={r.correspondant.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/correspondants/${r.correspondant.id}`)}
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:border-[var(--couleur-primaire)] dark:border-slate-700"
                >
                  {r.correspondant.nom}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

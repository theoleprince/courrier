import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox, PenLine, Search } from 'lucide-react';
import { useActeur } from '@/hooks/useActeur';
import { rechercherGlobal, type ResultatRecherche } from '@/services/recherche';
import { db } from '@/db/db';
import { TableauPilotage } from '@/components/pilotage/TableauPilotage';
import { Button } from '@/components/ui/Button';

export function Dashboard(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);

  const derniersConsultes = useLiveQuery(
    () =>
      db.historique
        .orderBy('date')
        .reverse()
        .filter((h) => h.action === 'CONSULTATION_SUIVI')
        .limit(5)
        .toArray(),
    [],
  );

  async function surRecherche(valeur: string) {
    setTexte(valeur);
    if (!acteur || valeur.trim().length < 2) {
      setResultats([]);
      return;
    }
    setResultats(await rechercherGlobal(valeur, acteur, 6));
  }

  const estPilote = acteur && ['DIRECTEUR', 'DG', 'CHEF', 'ADMIN'].includes(acteur.poste.role);
  // Même règle que le raccourci « N » : l'accueil et le bureau d'ordre enregistrent, les autres rédigent.
  const estGuichet = !acteur || ['ACCUEIL', 'BUREAU_ORDRE'].includes(acteur.poste.role);

  return (
    <div className="space-y-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pt-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {acteur ? t('tableauDeBord.bienvenue', { prenom: acteur.personne.prenom }) : t('tableauDeBord.titre')}
        </h1>

        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={texte}
            onChange={(e) => surRecherche(e.target.value)}
            placeholder={t('tableauDeBord.rechercherPlaceholder') ?? undefined}
            className="w-full rounded-full border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          {resultats.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white text-left shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {resultats.map((r) => (
                <button
                  key={r.type === 'courrier' ? r.courrier.id : r.correspondant.id}
                  type="button"
                  onClick={() =>
                    navigate(r.type === 'courrier' ? (r.courrier.codeSuivi ? `/suivi/${r.courrier.codeSuivi}` : `/courriers/${r.courrier.id}`) : `/correspondants/${r.correspondant.id}`)
                  }
                  className="block w-full truncate px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {r.type === 'courrier' ? `${r.courrier.numero ?? r.courrier.codeSuivi} — ${r.objetAffiche}` : r.correspondant.nom}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`flex flex-wrap justify-center gap-2 ${estGuichet ? '' : 'flex-row-reverse'}`}>
          <Button
            variante={estGuichet ? 'primaire' : 'secondaire'}
            onClick={() => navigate('/courriers/entrants/nouveau')}
          >
            <Inbox size={16} /> {t('courrier.nouveauEntrant')}
          </Button>
          <Button
            variante={estGuichet ? 'secondaire' : 'primaire'}
            onClick={() => navigate('/courriers/sortants/nouveau')}
          >
            <PenLine size={16} /> {t('courrier.nouveauSortant')}
          </Button>
        </div>

        {!!derniersConsultes?.length && (
          <p className="text-xs text-slate-400">
            {derniersConsultes.length} consultation(s) récente(s) — voir le journal d'audit pour le détail.
          </p>
        )}
      </div>

      {estPilote && <TableauPilotage />}
    </div>
  );
}

import { Building2 } from 'lucide-react';
import { enfantsDirects, titulaire, interimaires } from '@/services/organisation';
import type { Entite, Personne, Poste } from '@/types/models';

interface Props {
  entites: Entite[];
  postes: Poste[];
  personnes: Personne[];
  onSelectionnerPersonne: (personne: Personne) => void;
  racineId?: string | null;
}

export function ArbreOrganigramme({
  entites,
  postes,
  personnes,
  onSelectionnerPersonne,
  racineId = null,
}: Props): React.JSX.Element {
  const enfants = enfantsDirects(racineId, entites).filter((e) => e.actif);

  return (
    <ul className={racineId === null ? 'space-y-3' : 'ml-5 mt-2 space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700'}>
      {enfants.map((entite) => {
        const postesDeLEntite = postes.filter((p) => p.entiteId === entite.id && p.actif);
        return (
          <li key={entite.id}>
            <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <Building2 size={16} className="text-slate-400" />
              {entite.libelle}
            </div>

            {postesDeLEntite.length > 0 && (
              <ul className="ml-6 mt-1 space-y-1">
                {postesDeLEntite.map((poste) => {
                  const titulairePoste = titulaire(poste.id, personnes);
                  const interims = interimaires(poste.id, personnes);
                  return (
                    <li key={poste.id} className="text-sm">
                      <span className="text-slate-500 dark:text-slate-400">{poste.libelle} — </span>
                      {titulairePoste ? (
                        <button
                          type="button"
                          onClick={() => onSelectionnerPersonne(titulairePoste)}
                          className="font-medium text-[var(--couleur-primaire)] hover:underline"
                        >
                          {titulairePoste.prenom} {titulairePoste.nom}
                        </button>
                      ) : (
                        <span className="italic text-slate-400">—</span>
                      )}
                      {interims.map((personne) => (
                        <span key={personne.id}>
                          {' · '}
                          <button
                            type="button"
                            onClick={() => onSelectionnerPersonne(personne)}
                            className="text-[var(--couleur-primaire)] hover:underline"
                          >
                            {personne.prenom} {personne.nom}
                          </button>{' '}
                          <span className="text-xs text-slate-400">(intérim)</span>
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}

            <ArbreOrganigramme
              entites={entites}
              postes={postes}
              personnes={personnes}
              onSelectionnerPersonne={onSelectionnerPersonne}
              racineId={entite.id}
            />
          </li>
        );
      })}
    </ul>
  );
}

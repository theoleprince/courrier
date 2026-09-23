import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate } from 'react-router-dom';
import { KeyRound, Network } from 'lucide-react';
import { db } from '@/db/db';
import { useSessionStore } from '@/store/session';
import { useParametres } from '@/hooks/useParametres';
import { postesDisponibles } from '@/services/organisation';
import { authentifier } from '@/services/auth';
import { ArbreOrganigramme } from '@/components/organisation/ArbreOrganigramme';
import { Button } from '@/components/ui/Button';
import type { Personne, Poste } from '@/types/models';

type ModeConnexion = 'arbre' | 'identifiants';

export function Connexion(): React.JSX.Element {
  const { t } = useTranslation();
  const acteur = useSessionStore((s) => s.acteur);
  const connecter = useSessionStore((s) => s.connecter);
  const parametres = useParametres();

  const entites = useLiveQuery(() => db.entites.toArray());
  const postes = useLiveQuery(() => db.postes.toArray());
  const personnes = useLiveQuery(() => db.personnes.toArray());

  const [mode, setMode] = useState<ModeConnexion>('arbre');
  const [personneChoisie, setPersonneChoisie] = useState<Personne | null>(null);
  const [postesChoix, setPostesChoix] = useState<Poste[]>([]);

  if (acteur) return <Navigate to="/" replace />;

  async function choisirPersonne(personne: Personne) {
    const options = await postesDisponibles(personne);
    if (options.length <= 1) {
      if (options[0]) connecter({ personneId: personne.id, posteId: options[0].id });
      return;
    }
    setPersonneChoisie(personne);
    setPostesChoix(options);
  }

  if (!entites || !postes || !personnes) {
    return <div className="flex h-screen items-center justify-center">{t('commun.chargement')}</div>;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_10%_-10%,var(--primaire-anneau),transparent),radial-gradient(50rem_30rem_at_110%_110%,rgb(129_140_248/0.18),transparent)]"
      />
      <div className="anim-apparition relative w-full max-w-2xl rounded-2xl border border-[var(--bordure)] bg-[var(--surface)]/90 p-8 shadow-[var(--ombre-flottante)] backdrop-blur sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          {parametres?.logoPng && <img src={parametres.logoPng} alt="" className="h-12 w-12 rounded-xl shadow-sm" />}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {parametres?.nomOrganisation ?? t('app.titre')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('connexion.sousTitre')}</p>
          </div>
        </div>

        {personneChoisie ? (
          <div>
            <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{t('connexion.choisirPoste')}</p>
            <div className="space-y-2">
              {postesChoix.map((poste) => (
                <button
                  key={poste.id}
                  type="button"
                  onClick={() => connecter({ personneId: personneChoisie.id, posteId: poste.id })}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left hover:border-[var(--couleur-primaire)] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span>{poste.libelle}</span>
                  {personneChoisie.posteId !== poste.id && (
                    <span className="text-xs text-slate-400">{t('connexion.interim')}</span>
                  )}
                </button>
              ))}
            </div>
            <Button variante="discret" className="mt-4" onClick={() => setPersonneChoisie(null)}>
              {t('commun.retour')}
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-1 rounded-md bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('arbre')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${
                  mode === 'arbre'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Network size={14} /> {t('connexion.modeArbre')}
              </button>
              <button
                type="button"
                onClick={() => setMode('identifiants')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${
                  mode === 'identifiants'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <KeyRound size={14} /> {t('connexion.modeIdentifiants')}
              </button>
            </div>

            {mode === 'arbre' ? (
              <>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
                  {t('connexion.titre')}
                </h2>
                <ArbreOrganigramme
                  entites={entites}
                  postes={postes}
                  personnes={personnes}
                  onSelectionnerPersonne={choisirPersonne}
                />
              </>
            ) : (
              <FormulaireIdentifiants onAuthentifie={choisirPersonne} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormulaireIdentifiants({ onAuthentifie }: { onAuthentifie: (personne: Personne) => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(false);
    try {
      const personne = await authentifier(identifiant, motDePasse);
      if (personne) onAuthentifie(personne);
      else setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('connexion.identifiant')}</span>
        <input
          autoFocus
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          placeholder="prenom.nom@sanaga-industries.cm"
          className="champ"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('connexion.motDePasse')}</span>
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="champ"
        />
      </label>
      {erreur && <p className="text-sm text-red-500">{t('connexion.identifiantsInvalides')}</p>}
      <Button type="submit" variante="primaire" disabled={enCours || !identifiant || !motDePasse} className="w-full justify-center">
        {t('connexion.seConnecter')}
      </Button>
      <p className="text-center text-xs text-slate-400">{t('connexion.motDePasseDefaut', { motDePasse: '123456789' })}</p>
    </form>
  );
}

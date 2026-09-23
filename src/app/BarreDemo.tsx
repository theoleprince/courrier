import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ChevronDown, ChevronUp, RotateCcw, Users } from 'lucide-react';
import { db } from '@/db/db';
import { maintenant, decaler, revenirAuPresent } from '@/services/horloge';
import { verifierEcheances } from '@/services/notifications';
import { useDemoStore } from '@/store/demo';
import { useSessionStore } from '@/store/session';
import { reinitialiserDemo } from '@/services/donnees';
import { Button } from '@/components/ui/Button';
import type { Entite, Personne } from '@/types/models';

/** Chemin de l'entité depuis la racine de l'organigramme, ex. [DG, DAF, Service comptabilité]. */
function cheminEntite(entiteId: string | undefined, entites: Map<string, Entite>): Entite[] {
  const chemin: Entite[] = [];
  let courante = entiteId ? entites.get(entiteId) : undefined;
  while (courante && !chemin.includes(courante)) {
    chemin.unshift(courante);
    courante = courante.parentId ? entites.get(courante.parentId) : undefined;
  }
  return chemin;
}

export function BarreDemo(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const repliee = useDemoStore((s) => s.barreRepliee);
  const basculer = useDemoStore((s) => s.basculerBarre);
  const connecter = useSessionStore((s) => s.connecter);
  const [horlogeAffichee, setHorlogeAffichee] = useState(maintenant());
  const [afficherUtilisateurs, setAfficherUtilisateurs] = useState(false);
  const annuaire = useLiveQuery(async () => {
    const [personnes, postes, entites] = await Promise.all([db.personnes.toArray(), db.postes.toArray(), db.entites.toArray()]);
    return { personnes, postes: new Map(postes.map((p) => [p.id, p])), entites: new Map(entites.map((e) => [e.id, e])) };
  });

  useEffect(() => {
    const id = setInterval(() => setHorlogeAffichee(maintenant()), 1000);
    return () => clearInterval(id);
  }, []);

  async function avancer(minutes: number) {
    await decaler(minutes);
    setHorlogeAffichee(maintenant());
    await verifierEcheances();
  }

  async function revenir() {
    await revenirAuPresent();
    setHorlogeAffichee(maintenant());
    await verifierEcheances();
  }

  async function connecterCommePersonne(personne: Personne) {
    if (!personne.posteId) return;
    connecter({ personneId: personne.id, posteId: personne.posteId });
    setAfficherUtilisateurs(false);
  }

  // Chaque personne avec son poste et sa place dans l'organigramme, triée du sommet vers la base.
  const liste = (annuaire?.personnes ?? [])
    .filter((p) => p.actif)
    .map((personne) => {
      const poste = personne.posteId ? annuaire?.postes.get(personne.posteId) : undefined;
      const chemin = annuaire ? cheminEntite(poste?.entiteId, annuaire.entites) : [];
      return { personne, poste, chemin };
    })
    .sort(
      (a, b) =>
        a.chemin.length - b.chemin.length ||
        a.chemin.map((e) => e.libelle).join('/').localeCompare(b.chemin.map((e) => e.libelle).join('/')) ||
        Number(b.poste?.estResponsable ?? false) - Number(a.poste?.estResponsable ?? false) ||
        a.personne.nom.localeCompare(b.personne.nom),
    );

  if (repliee) {
    return (
      <button
        type="button"
        onClick={basculer}
        className="fixed bottom-3 right-3 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-slate-800"
      >
        <ChevronUp size={14} className="inline" /> {t('demo.titre')}
      </button>
    );
  }

  return (
    <div className="relative border-t border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-amber-800 dark:text-amber-300">{t('demo.titre')}</span>
        <span className="rounded bg-white px-2 py-1 font-mono text-xs dark:bg-slate-800">
          {format(horlogeAffichee, 'PPPp', { locale: i18n.language === 'en' ? enUS : fr })}
        </span>

        <Button variante="secondaire" className="text-xs" onClick={() => avancer(60)}>
          {t('demo.avancerUneHeure')}
        </Button>
        <Button variante="secondaire" className="text-xs" onClick={() => avancer(60 * 24)}>
          {t('demo.avancerUnJour')}
        </Button>
        <Button variante="secondaire" className="text-xs" onClick={() => avancer(60 * 24 * 7)}>
          {t('demo.avancerUneSemaine')}
        </Button>
        <Button variante="discret" className="text-xs" onClick={revenir}>
          {t('demo.revenirAuPresent')}
        </Button>

        <div className="relative">
          <Button
            variante="secondaire"
            className="text-xs"
            onClick={() => setAfficherUtilisateurs((v) => !v)}
          >
            <Users size={14} /> {t('demo.changerUtilisateur')}
          </Button>
          {afficherUtilisateurs && (
            <div className="absolute bottom-full mb-2 max-h-96 w-80 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {liste.map(({ personne, poste, chemin }) => (
                <button
                  key={personne.id}
                  type="button"
                  onClick={() => connecterCommePersonne(personne)}
                  className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  style={{ paddingLeft: `${0.5 + Math.max(0, chemin.length - 1) * 0.75}rem` }}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--couleur-primaire)] text-[10px] font-semibold text-white">
                    {personne.prenom[0]}
                    {personne.nom[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block">
                      {personne.prenom} {personne.nom}
                    </span>
                    {poste && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{poste.libelle}</span>}
                    {chemin.length > 0 && (
                      <span className="block truncate text-[11px] text-slate-400" title={chemin.map((e) => e.libelle).join(' › ')}>
                        {chemin.map((e, i) => (i === chemin.length - 1 ? e.libelle : e.code)).join(' › ')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variante="discret"
          className="text-xs"
          onClick={() => {
            if (confirm(t('demo.reinitialiser') + ' ?')) void reinitialiserDemo();
          }}
        >
          <RotateCcw size={14} /> {t('demo.reinitialiser')}
        </Button>

        <button
          type="button"
          onClick={basculer}
          title={t('demo.replier') ?? undefined}
          className="ml-auto rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
}

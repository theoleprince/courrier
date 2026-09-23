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
import type { Personne } from '@/types/models';

export function BarreDemo(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const repliee = useDemoStore((s) => s.barreRepliee);
  const basculer = useDemoStore((s) => s.basculerBarre);
  const connecter = useSessionStore((s) => s.connecter);
  const [horlogeAffichee, setHorlogeAffichee] = useState(maintenant());
  const [afficherUtilisateurs, setAfficherUtilisateurs] = useState(false);
  const toutesPersonnes = useLiveQuery(() => db.personnes.toArray());

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

  const liste = (toutesPersonnes ?? []).filter((p) => p.actif);

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
            <div className="absolute bottom-full mb-2 max-h-64 w-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {liste.map((personne) => (
                <button
                  key={personne.id}
                  type="button"
                  onClick={() => connecterCommePersonne(personne)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--couleur-primaire)] text-[10px] font-semibold text-white">
                    {personne.prenom[0]}
                    {personne.nom[0]}
                  </span>
                  {personne.prenom} {personne.nom}
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

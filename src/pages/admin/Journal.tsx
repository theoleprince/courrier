import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { db } from '@/db/db';
import { verifierJournal, type ResultatVerificationJournal } from '@/services/journal';
import { Button } from '@/components/ui/Button';

export function Journal(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const [resultat, setResultat] = useState<ResultatVerificationJournal | null>(null);
  const [enCours, setEnCours] = useState(false);
  const entrees = useLiveQuery(() => db.historique.orderBy('sequence').reverse().limit(200).toArray()) ?? [];

  async function verifier() {
    setEnCours(true);
    try {
      setResultat(await verifierJournal());
    } finally {
      setEnCours(false);
    }
  }

  async function simulerFalsification() {
    const premiere = await db.historique.orderBy('sequence').first();
    if (!premiere) return;
    await db.historique.update(premiere.id, { commentaire: '(falsifié à des fins de démonstration)' });
    setResultat(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.administration')} — Journal d'audit</h1>
        <div className="flex gap-2">
          <Button variante="secondaire" disabled={enCours} onClick={verifier}>
            <ShieldCheck size={16} /> Vérifier l'intégrité du journal
          </Button>
          <Button variante="discret" onClick={simulerFalsification}>
            <AlertTriangle size={16} /> Simuler une falsification
          </Button>
        </div>
      </div>

      {resultat && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
            resultat.valide
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {resultat.valide ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          {resultat.valide
            ? `Journal intact (${resultat.entreesVerifiees} entrées vérifiées).`
            : `Falsification détectée à la séquence ${resultat.premiereSequenceCorrompue}.`}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Séq.</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Acteur</th>
              <th className="px-3 py-2">Commentaire</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Empreinte</th>
            </tr>
          </thead>
          <tbody>
            {entrees.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{h.sequence}</td>
                <td className="px-3 py-2">{h.action}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{h.acteurId}</td>
                <td className="px-3 py-2 text-slate-500">{h.commentaire}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{format(new Date(h.date), 'Pp', { locale })}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{h.empreinte.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { exporterDonnees, importerDonnees, reinitialiserDemo } from '@/services/donnees';
import { toastErreur, toastSucces } from '@/store/toasts';
import { messageErreur } from '@/services/traduireErreur';
import { Button } from '@/components/ui/Button';

export function Donnees(): React.JSX.Element {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);

  async function exporter() {
    const blob = await exporterDonnees();
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `gestion-courrier-${new Date().toISOString().slice(0, 10)}.json`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function importer(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    try {
      await importerDonnees(fichier);
      toastSucces(t('commun.confirmer'));
      window.location.href = '/';
    } catch (erreur) {
      toastErreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  async function reinitialiser() {
    if (!confirm(t('demo.reinitialiser') + ' ?')) return;
    await reinitialiserDemo();
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.administration')} — Données</h1>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <Button variante="secondaire" onClick={exporter} className="w-full justify-start">
          <Download size={16} /> Exporter (JSON)
        </Button>
        <Button variante="secondaire" onClick={() => inputRef.current?.click()} disabled={enCours} className="w-full justify-start">
          <Upload size={16} /> Importer (JSON)
        </Button>
        <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={(e) => importer(e.target.files?.[0])} />
      </div>

      <div className="rounded-lg border border-red-200 p-4 dark:border-red-900">
        <Button variante="danger" onClick={reinitialiser} className="w-full justify-start">
          <RotateCcw size={16} /> {t('demo.reinitialiser')}
        </Button>
      </div>
    </div>
  );
}

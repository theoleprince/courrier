import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { variablesDepuisLettre } from '@/services/documents';
import { toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { Tabs, type Onglet } from '@/components/ui/Tabs';
import type { ModeleLettre } from '@/types/models';

export function ModelesLettre(): React.JSX.Element {
  const { t } = useTranslation();
  const tousModeles = useLiveQuery(() => db.modelesLettre.toArray()) ?? [];
  const [langue, setLangue] = useState<ModeleLettre['langue']>('fr');
  const modeles = tousModeles.filter((m) => m.langue === langue);
  const [selectionId, setSelectionId] = useState<string>();
  const selection = modeles.find((m) => m.id === selectionId) ?? modeles[0];

  const onglets: Onglet<ModeleLettre['langue']>[] = [
    { id: 'fr', libelle: `Français (${tousModeles.filter((m) => m.langue === 'fr').length})` },
    { id: 'en', libelle: `English (${tousModeles.filter((m) => m.langue === 'en').length})` },
  ];

  function changerLangue(nouvelle: ModeleLettre['langue']) {
    setLangue(nouvelle);
    setSelectionId(undefined);
    setObjet(undefined);
    setCorps(undefined);
  }
  const [objet, setObjet] = useState<string>();
  const [corps, setCorps] = useState<string>();

  const objetActuel = objet ?? selection?.objet ?? '';
  const corpsActuel = corps ?? selection?.corps ?? '';

  async function enregistrer() {
    if (!selection) return;
    await db.modelesLettre.update(selection.id, { objet: objetActuel, corps: corpsActuel });
    toastSucces(t('commun.enregistrer'));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        {t('nav.administration')} — Modèles de lettre
      </h1>
      <Tabs onglets={onglets} actif={langue} onChange={changerLangue} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <ul className="space-y-1 md:col-span-1">
          {modeles.map((m: ModeleLettre) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectionId(m.id);
                  setObjet(undefined);
                  setCorps(undefined);
                }}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                  selection?.id === m.id
                    ? 'bg-[var(--couleur-primaire)]/10 text-[var(--couleur-primaire)]'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {m.libelle}
              </button>
            </li>
          ))}
        </ul>

        {selection && (
          <div className="space-y-3 md:col-span-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('courrier.objet')}
              </span>
              <input
                className="champ"
                value={objetActuel}
                onChange={(e) => setObjet(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Corps
              </span>
              <textarea
                className="champ"
                rows={10}
                value={corpsActuel}
                onChange={(e) => setCorps(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-1 text-xs text-slate-400">
              {variablesDepuisLettre(selection).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCorps(`${corpsActuel} {{${v}}}`)}
                  className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            <Button variante="primaire" onClick={enregistrer}>
              {t('commun.enregistrer')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

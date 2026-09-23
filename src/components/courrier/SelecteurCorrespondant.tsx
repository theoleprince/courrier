import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { db } from '@/db/db';
import { uid } from '@/services/crypto';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Correspondant } from '@/types/models';

interface Props {
  valeur: string | undefined;
  onChange: (id: string) => void;
}

export function SelecteurCorrespondant({ valeur, onChange }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [recherche, setRecherche] = useState('');
  const [ouvrirCreation, setOuvrirCreation] = useState(false);
  const [ouvrirListe, setOuvrirListe] = useState(false);

  const correspondants = useLiveQuery(() => db.correspondants.toArray()) ?? [];
  const selectionne = correspondants.find((c) => c.id === valeur);

  const filtres = correspondants.filter((c) =>
    `${c.nom} ${c.organisation ?? ''}`.toLowerCase().includes(recherche.toLowerCase()),
  );

  async function creerRapide(nom: string) {
    const nouveau: Correspondant = { id: uid(), nom, categorie: 'PARTICULIER' };
    await db.correspondants.add(nouveau);
    onChange(nouveau.id);
    setOuvrirCreation(false);
    setOuvrirListe(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvrirListe((v) => !v)}
        className="champ flex items-center justify-between text-left"
      >
        <span>{selectionne ? selectionne.nom : t('courrier.correspondant')}</span>
        <Search size={14} className="text-slate-400" />
      </button>

      {ouvrirListe && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <input
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('courrier.correspondant') ?? undefined}
            className="champ mb-2"
          />
          <ul className="max-h-48 overflow-y-auto">
            {filtres.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOuvrirListe(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {c.nom} {c.organisation ? `(${c.organisation})` : ''}
                </button>
              </li>
            ))}
            {filtres.length === 0 && <li className="px-2 py-1.5 text-sm text-slate-400">{t('commun.aucunResultat')}</li>}
          </ul>
          <Button
            type="button"
            variante="discret"
            className="mt-1 w-full justify-start"
            onClick={() => setOuvrirCreation(true)}
          >
            <Plus size={14} /> {t('courrier.nouveauCorrespondant')}
          </Button>
        </div>
      )}

      {ouvrirCreation && (
        <Modal titre={t('courrier.nouveauCorrespondant')} onFermer={() => setOuvrirCreation(false)}>
          <FormulaireCorrespondantRapide onCreer={creerRapide} />
        </Modal>
      )}
    </div>
  );
}

function FormulaireCorrespondantRapide({ onCreer }: { onCreer: (nom: string) => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nom.trim()) onCreer(nom.trim());
      }}
      className="space-y-3"
    >
      <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} className="champ" placeholder={t('courrier.correspondant') ?? undefined} />
      <Button type="submit" variante="primaire" disabled={!nom.trim()}>
        {t('commun.enregistrer')}
      </Button>
    </form>
  );
}

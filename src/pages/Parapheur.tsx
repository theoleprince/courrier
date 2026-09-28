import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { parapheur, objetAffiche } from '@/services/requetes';
import { signer, signerEnLot } from '@/services/workflow';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { ApercuDocument } from '@/components/courrier/ApercuDocument';
import { PadSignature, type OptionsSignature } from '@/components/courrier/PadSignature';
import { useParametres } from '@/hooks/useParametres';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { origineApp } from '@/services/urls';

export function Parapheur(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const parametres = useParametres();
  const taches = useLiveQuery(() => (acteur ? parapheur(acteur.poste.id) : []), [acteur?.poste.id]) ?? [];
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [ouvrirSignature, setOuvrirSignature] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const premiereSelection = taches.find((t) => selection.has(t.circuit.id));
  const pieces = useLiveQuery(
    () => (premiereSelection ? db.piecesJointes.where('[courrierId+nature]').equals([premiereSelection.courrier.id, 'BROUILLON']).toArray() : []),
    [premiereSelection?.courrier.id],
  );
  const derniereVersion = pieces && pieces.length > 0 ? [...pieces].sort((a, b) => b.version - a.version)[0] : undefined;

  function basculer(id: string) {
    setSelection((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  async function surSigner(imagePngDataUrl: string, { avecCachet }: OptionsSignature) {
    if (!acteur || selection.size === 0) return;
    setEnCours(true);
    try {
      const acteurCourant = { personneId: acteur.personne.id, posteId: acteur.poste.id };
      const contexte = { imagePngDataUrl, origineUrl: origineApp(), avecCachet };
      if (selection.size === 1) {
        await signer([...selection][0], acteurCourant, contexte);
        toastSucces(t('parapheur.signer'));
      } else {
        const resultats = await signerEnLot([...selection], acteurCourant, contexte);
        const succes = resultats.filter((r) => r.succes).length;
        toastSucces(`${succes} / ${resultats.length}`);
      }
      setSelection(new Set());
      setOuvrirSignature(false);
    } catch (erreur) {
      toastErreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('parapheur.titre')}</h1>

      {taches.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('parapheur.vide')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-2">
            {taches.map((tache) => (
              <label
                key={tache.circuit.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  selection.has(tache.circuit.id)
                    ? 'border-[var(--couleur-primaire)] bg-[var(--couleur-primaire)]/5'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selection.has(tache.circuit.id)}
                  onChange={() => basculer(tache.circuit.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {tache.courrier.numero ?? tache.courrier.codeSuivi}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{objetAffiche(tache.courrier, 'COMPLET')}</p>
                </div>
                {/* Ouvrir la fiche : annoter, confier le travail, consulter le parcours avant de signer. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/courriers/${tache.courrier.id}`);
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[var(--couleur-primaire)] hover:bg-[var(--primaire-doux)]"
                >
                  {t('parapheur.ouvrir')}
                </button>
              </label>
            ))}

            <Button variante="primaire" disabled={selection.size === 0} onClick={() => setOuvrirSignature(true)} className="mt-2">
              {selection.size > 1 ? t('parapheur.signerSelection') : t('parapheur.signer')}
              {selection.size > 0 ? ` (${selection.size})` : ''}
            </Button>
          </div>

          <div className="lg:col-span-3">
            <ApercuDocument blob={derniereVersion?.contenu} />
          </div>
        </div>
      )}

      {ouvrirSignature && (
        <Modal titre={t('signature.titre')} onFermer={() => setOuvrirSignature(false)}>
          <PadSignature
            signatureExistante={acteur?.personne.derniereSignaturePng}
            cachet={parametres?.cachetPng}
            onValider={surSigner}
            onAnnuler={() => setOuvrirSignature(false)}
            enCours={enCours}
          />
        </Modal>
      )}
    </div>
  );
}

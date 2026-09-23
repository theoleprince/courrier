import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { db } from '@/db/db';
import { toastErreur, toastSucces } from '@/store/toasts';
import { SelecteurPoste } from '@/components/organisation/SelecteurPoste';
import { Button } from '@/components/ui/Button';
import { Tabs, type Onglet } from '@/components/ui/Tabs';
import type { EtapeModele, ModeleCircuit, RoleCible, TypeEtape } from '@/types/models';

const typesEtape: TypeEtape[] = ['IMPUTATION', 'TRAITEMENT', 'VISA', 'VALIDATION', 'SIGNATURE', 'EXPEDITION'];
const rolesCible: RoleCible[] = ['BUREAU_ORDRE', 'REDACTEUR', 'RESPONSABLE_ENTITE_TRAITANTE', 'DIRECTEUR_ENTITE_TRAITANTE'];

function etapeParDefaut(ordre: number): EtapeModele {
  return { ordre, type: 'TRAITEMENT', libelle: 'Nouvelle étape', roleCible: 'RESPONSABLE_ENTITE_TRAITANTE', delaiJours: 2, sauterSiRedacteur: false };
}

/** Entrant : doit commencer par IMPUTATION. Sortant : doit contenir SIGNATURE et se terminer par EXPEDITION (section 13). */
function validerCircuit(sens: ModeleCircuit['sens'], etapes: EtapeModele[]): string | null {
  if (etapes.length === 0) return 'Le circuit doit comporter au moins une étape.';
  if (sens === 'ENTRANT' && etapes[0].type !== 'IMPUTATION') {
    return 'Un circuit entrant doit commencer par une étape Imputation.';
  }
  if (sens === 'SORTANT') {
    if (!etapes.some((e) => e.type === 'SIGNATURE')) return 'Un circuit sortant doit contenir une étape Signature.';
    if (etapes[etapes.length - 1].type !== 'EXPEDITION') return 'Un circuit sortant doit se terminer par Expédition.';
  }
  for (const etape of etapes) {
    if (!etape.posteCibleId && !etape.roleCible) return `L'étape « ${etape.libelle} » doit avoir un poste ou un rôle cible.`;
  }
  return null;
}

export function Circuits(): React.JSX.Element {
  const { t } = useTranslation();
  const modeles = useLiveQuery(() => db.modelesCircuit.toArray()) ?? [];
  const [circuitId, setCircuitId] = useState<string>();

  // Une seule ligne d'onglets : circuits entrants d'abord, puis sortants.
  const ordonnes = [...modeles].sort((a, b) => Number(a.sens === 'SORTANT') - Number(b.sens === 'SORTANT'));
  const circuitActif = ordonnes.find((m) => m.id === circuitId) ?? ordonnes[0];
  const onglets: Onglet<string>[] = ordonnes.map((m) => ({
    id: m.id,
    libelle: m.actif ? m.libelle : `${m.libelle} (désactivé)`,
  }));

  async function basculerActif(id: string, actif: boolean) {
    await db.modelesCircuit.update(id, { actif: !actif });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.administration')} — Circuits</h1>
      {circuitActif && <Tabs onglets={onglets} actif={circuitActif.id} onChange={setCircuitId} />}
      {/* Tous les éditeurs restent montés (masqués hors onglet) pour ne pas perdre une modification non enregistrée. */}
      {modeles.map((modele) => (
        <div key={modele.id} hidden={modele.id !== circuitActif?.id}>
          <EditeurCircuit modele={modele} onBasculerActif={basculerActif} />
        </div>
      ))}
    </div>
  );
}

function EditeurCircuit({
  modele,
  onBasculerActif,
}: {
  modele: ModeleCircuit;
  onBasculerActif: (id: string, actif: boolean) => void;
}): React.JSX.Element {
  const [etapes, setEtapes] = useState<EtapeModele[]>(() => [...modele.etapes].sort((a, b) => a.ordre - b.ordre));
  const [modifie, setModifie] = useState(false);

  function majEtape(index: number, partiel: Partial<EtapeModele>) {
    setEtapes((liste) => liste.map((e, i) => (i === index ? { ...e, ...partiel } : e)));
    setModifie(true);
  }
  function deplacer(index: number, direction: -1 | 1) {
    setEtapes((liste) => {
      const cible = index + direction;
      if (cible < 0 || cible >= liste.length) return liste;
      const copie = [...liste];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setModifie(true);
  }
  function supprimer(index: number) {
    setEtapes((liste) => liste.filter((_, i) => i !== index));
    setModifie(true);
  }
  function ajouter() {
    setEtapes((liste) => [...liste, etapeParDefaut(liste.length + 1)]);
    setModifie(true);
  }

  async function enregistrer() {
    const erreur = validerCircuit(modele.sens, etapes);
    if (erreur) {
      toastErreur(erreur);
      return;
    }
    const etapesOrdonnees = etapes.map((e, i) => ({ ...e, ordre: i + 1 }));
    await db.modelesCircuit.update(modele.id, { etapes: etapesOrdonnees });
    setModifie(false);
    toastSucces('Circuit enregistré');
  }

  return (
    <div className={`rounded-lg border p-4 dark:border-slate-700 ${modele.actif ? '' : 'opacity-50'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-slate-800 dark:text-slate-100">
          {modele.libelle}{' '}
          <span className="text-xs text-slate-400">({modele.sens === 'ENTRANT' ? 'entrant' : 'sortant'})</span>
        </h2>
        <Button variante="discret" onClick={() => onBasculerActif(modele.id, modele.actif)}>
          {modele.actif ? 'Désactiver' : 'Activer'}
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        {modele.typesCourrier.length === 0 ? 'Modèle par défaut' : modele.typesCourrier.join(', ')}
      </p>

      <div className="space-y-2">
        {etapes.map((etape, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex flex-col">
              <button type="button" onClick={() => deplacer(index, -1)} disabled={index === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => deplacer(index, 1)}
                disabled={index === etapes.length - 1}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <span className="w-5 text-center text-xs text-slate-400">{index + 1}</span>
            <input className="champ w-40" value={etape.libelle} onChange={(e) => majEtape(index, { libelle: e.target.value })} />
            <select className="champ w-36" value={etape.type} onChange={(e) => majEtape(index, { type: e.target.value as TypeEtape })}>
              {typesEtape.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="champ w-28"
              value={etape.posteCibleId ? 'poste' : 'role'}
              onChange={(e) =>
                e.target.value === 'poste'
                  ? majEtape(index, { roleCible: undefined, posteCibleId: '' })
                  : majEtape(index, { posteCibleId: undefined, roleCible: 'RESPONSABLE_ENTITE_TRAITANTE' })
              }
            >
              <option value="role">Rôle</option>
              <option value="poste">Poste précis</option>
            </select>
            {etape.posteCibleId !== undefined ? (
              <SelecteurPoste valeur={etape.posteCibleId} onChange={(id) => majEtape(index, { posteCibleId: id })} placeholder="Poste" />
            ) : (
              <select className="champ w-56" value={etape.roleCible} onChange={(e) => majEtape(index, { roleCible: e.target.value as RoleCible })}>
                {rolesCible.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              min={1}
              className="champ w-20"
              value={etape.delaiJours}
              onChange={(e) => majEtape(index, { delaiJours: Number(e.target.value) })}
            />
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={etape.sauterSiRedacteur} onChange={(e) => majEtape(index, { sauterSiRedacteur: e.target.checked })} />
              saut auto
            </label>
            <button type="button" onClick={() => supprimer(index)} className="ml-auto text-slate-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button variante="discret" onClick={ajouter}>
          <Plus size={14} /> Ajouter une étape
        </Button>
        <Button variante="primaire" disabled={!modifie} onClick={enregistrer}>
          Enregistrer
        </Button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Aperçu : ce circuit passera par {etapes.map((e) => e.libelle).join(' → ')}.
      </p>
    </div>
  );
}

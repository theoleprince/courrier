import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { db } from '@/db/db';
import { toastErreur, toastSucces } from '@/store/toasts';
import { SelecteurPoste } from '@/components/organisation/SelecteurPoste';
import { Button } from '@/components/ui/Button';
import { Tabs, type Onglet } from '@/components/ui/Tabs';
import type { EtapeModele, ModeleCircuit, RoleCible, TypeEtape } from '@/types/models';

const typesEtape: TypeEtape[] = ['IMPUTATION', 'TRAITEMENT', 'VISA', 'VALIDATION', 'SIGNATURE', 'EXPEDITION'];
const rolesCible: RoleCible[] = ['BUREAU_ORDRE', 'REDACTEUR', 'RESPONSABLE_ENTITE_TRAITANTE', 'DIRECTEUR_ENTITE_TRAITANTE'];

/** Libellés lisibles des types d'étape, avec ce que fait concrètement la personne. */
const libellesType: Record<TypeEtape, { nom: string; aide: string }> = {
  IMPUTATION: { nom: 'Imputation', aide: 'Oriente le courrier vers le service qui le traitera.' },
  TRAITEMENT: { nom: 'Traitement', aide: 'Le service traite le courrier, puis le marque traité.' },
  VISA: { nom: 'Visa', aide: 'Appose son paraphe « Lu et approuvé » sur le document.' },
  VALIDATION: { nom: 'Validation', aide: 'Appose son paraphe « Validé » sur le document.' },
  SIGNATURE: { nom: 'Signature', aide: 'Signe électroniquement le document.' },
  EXPEDITION: { nom: 'Expédition', aide: 'Envoie le courrier signé et lui donne son numéro DEP-….' },
};

const libellesRole: Record<RoleCible, string> = {
  BUREAU_ORDRE: 'Le bureau d’ordre',
  REDACTEUR: 'La personne qui a rédigé le courrier',
  RESPONSABLE_ENTITE_TRAITANTE: 'Le chef du service qui traite',
  DIRECTEUR_ENTITE_TRAITANTE: 'Le directeur du service qui traite',
};

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
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Circuits de traitement</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Les étapes par lesquelles passe un courrier, dans l’ordre. Une modification s’applique aux courriers enregistrés ensuite.
        </p>
      </div>
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

  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* En-tête : de quel circuit il s'agit, à quoi il s'applique, son parcours d'un coup d'œil. */}
      <div className="border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{modele.libelle}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {modele.sens === 'ENTRANT' ? 'Courrier reçu' : 'Courrier envoyé'}
              </span>
              {modele.typesCourrier.length === 0
                ? 'Circuit par défaut (types sans circuit dédié)'
                : `S’applique aux : ${modele.typesCourrier.map((type) => t(`typeCourrier.${type}`)).join(', ')}`}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={modele.actif} onChange={() => onBasculerActif(modele.id, modele.actif)} />
            Circuit actif
          </label>
        </div>

        <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
          {etapes.map((etape, index) => (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && <ArrowRight size={14} className="text-slate-300" />}
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {etape.libelle || libellesType[etape.type].nom}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={`space-y-3 p-5 ${modele.actif ? '' : 'opacity-60'}`}>
        {etapes.map((etape, index) => (
          <CarteEtape
            key={index}
            etape={etape}
            numero={index + 1}
            premiere={index === 0}
            derniere={index === etapes.length - 1}
            onChange={(partiel) => majEtape(index, partiel)}
            onMonter={() => deplacer(index, -1)}
            onDescendre={() => deplacer(index, 1)}
            onSupprimer={() => supprimer(index)}
          />
        ))}

        <button
          type="button"
          onClick={ajouter}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400"
        >
          <Plus size={16} /> Ajouter une étape
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
        {modifie && <span className="text-sm text-amber-600 dark:text-amber-400">Modifications non enregistrées</span>}
        <Button variante="primaire" disabled={!modifie} onClick={enregistrer}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

/** Une étape du circuit : chaque réglage a son intitulé, les codes techniques sont traduits. */
function CarteEtape({
  etape,
  numero,
  premiere,
  derniere,
  onChange,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  etape: EtapeModele;
  numero: number;
  premiere: boolean;
  derniere: boolean;
  onChange: (partiel: Partial<EtapeModele>) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onSupprimer: () => void;
}): React.JSX.Element {
  const parPoste = etape.posteCibleId !== undefined;
  // Le saut automatique n'est appliqué par le moteur qu'aux visas et validations.
  const sautPossible = etape.type === 'VISA' || etape.type === 'VALIDATION';
  const boutonIcone =
    'rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-800';

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
          {numero}
        </span>
        <input
          aria-label="Nom de l’étape"
          className="champ flex-1 font-medium"
          value={etape.libelle}
          onChange={(e) => onChange({ libelle: e.target.value })}
        />
        <div className="flex shrink-0 items-center">
          <button type="button" title="Monter" onClick={onMonter} disabled={premiere} className={boutonIcone}>
            <ChevronUp size={16} />
          </button>
          <button type="button" title="Descendre" onClick={onDescendre} disabled={derniere} className={boutonIcone}>
            <ChevronDown size={16} />
          </button>
          <button type="button" title="Supprimer l’étape" onClick={onSupprimer} className={`${boutonIcone} hover:text-red-600`}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:ml-10 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_auto]">
        <Champ intitule="Type d’étape" aide={libellesType[etape.type].aide}>
          <select className="champ" value={etape.type} onChange={(e) => onChange({ type: e.target.value as TypeEtape })}>
            {typesEtape.map((v) => (
              <option key={v} value={v}>
                {libellesType[v].nom}
              </option>
            ))}
          </select>
        </Champ>

        <Champ intitule="Qui s’en charge ?">
          <div className="space-y-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-700">
              {([false, true] as const).map((poste) => (
                <button
                  key={String(poste)}
                  type="button"
                  onClick={() =>
                    poste
                      ? onChange({ roleCible: undefined, posteCibleId: etape.posteCibleId ?? '' })
                      : onChange({ posteCibleId: undefined, roleCible: etape.roleCible ?? 'RESPONSABLE_ENTITE_TRAITANTE' })
                  }
                  className={`rounded-md px-3 py-1 ${
                    parPoste === poste
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  {poste ? 'Un poste précis' : 'Selon le courrier'}
                </button>
              ))}
            </div>
            {parPoste ? (
              <SelecteurPoste valeur={etape.posteCibleId} onChange={(id) => onChange({ posteCibleId: id })} placeholder="Choisir un poste…" />
            ) : (
              <select className="champ" value={etape.roleCible} onChange={(e) => onChange({ roleCible: e.target.value as RoleCible })}>
                {rolesCible.map((v) => (
                  <option key={v} value={v}>
                    {libellesRole[v]}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Champ>

        <Champ intitule="Délai">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="champ w-20"
              value={etape.delaiJours}
              onChange={(e) => onChange({ delaiJours: Number(e.target.value) })}
            />
            <span className="text-sm text-slate-500">jour{etape.delaiJours > 1 ? 's' : ''}</span>
          </div>
        </Champ>
      </div>

      {sautPossible && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-600 sm:ml-10 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={etape.sauterSiRedacteur}
            onChange={(e) => onChange({ sauterSiRedacteur: e.target.checked })}
          />
          <span>
            Passer cette étape automatiquement si la personne concernée est celle qui a rédigé le courrier ou fait l’étape précédente
            <span className="block text-xs text-slate-400">
              Par exemple, un chef de service ne vise pas un courrier qu’il a lui-même rédigé.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

function Champ({ intitule, aide, children }: { intitule: string; aide?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{intitule}</p>
      {children}
      {aide && <p className="mt-1.5 text-xs text-slate-400">{aide}</p>}
    </div>
  );
}

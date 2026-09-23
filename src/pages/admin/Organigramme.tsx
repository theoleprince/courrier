import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import {
  creerEntite,
  creerPersonne,
  creerPoste,
  desactiverEntite,
  desactiverPersonne,
  desactiverPoste,
  modifierEntite,
  reactiverEntite,
  type DonneesEntite,
} from '@/services/organisation';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { SelecteurEntite } from '@/components/organisation/SelecteurEntite';
import { Button } from '@/components/ui/Button';
import { Tabs, type Onglet } from '@/components/ui/Tabs';
import type { Entite, ID, Personne, Poste, RoleSysteme, TypeEntite } from '@/types/models';

const typesEntite: TypeEntite[] = ['DIRECTION', 'DEPARTEMENT', 'SERVICE'];
const libellesTypeEntite: Record<TypeEntite, string> = {
  DIRECTION: 'Directions',
  DEPARTEMENT: 'Départements',
  SERVICE: 'Services',
};
const roles: RoleSysteme[] = [
  'ACCUEIL',
  'BUREAU_ORDRE',
  'AGENT',
  'CHEF',
  'DIRECTEUR',
  'DG',
  'ADMIN',
];

type IdOnglet = 'entites' | 'postes' | 'personnes';

const retrait = (niveau: number) => `${niveau * 1.25}rem`;

/** Entités dans l'ordre de l'arbre (parent puis enfants), avec leur profondeur. */
function entitesEnArbre(entites: Entite[]): { entite: Entite; profondeur: number }[] {
  const resultat: { entite: Entite; profondeur: number }[] = [];
  const ids = new Set(entites.map((e) => e.id));
  function visiter(parentId: ID | null, profondeur: number) {
    for (const e of entites.filter((x) => x.parentId === parentId)) {
      resultat.push({ entite: e, profondeur });
      visiter(e.id, profondeur + 1);
    }
  }
  visiter(null, 0);
  // Entités dont le parent est introuvable : en fin de liste plutôt que perdues.
  for (const e of entites) {
    if (e.parentId && !ids.has(e.parentId)) resultat.push({ entite: e, profondeur: 0 });
  }
  return resultat;
}

/** Poste responsable d'abord, puis ordre alphabétique. */
function trierPostes(postes: Poste[]): Poste[] {
  return [...postes].sort(
    (a, b) =>
      Number(b.estResponsable) - Number(a.estResponsable) || a.libelle.localeCompare(b.libelle),
  );
}

function trierPersonnes(personnes: Personne[]): Personne[] {
  return [...personnes].sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`),
  );
}

function EnTeteEntite({
  entite,
  profondeur,
}: {
  entite: Entite;
  profondeur: number;
}): React.JSX.Element {
  return (
    <h3
      className="flex items-center gap-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
      style={{ paddingLeft: retrait(profondeur) }}
    >
      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
        {entite.code}
      </span>
      {entite.libelle}
      {!entite.actif && <span className="text-xs font-normal text-slate-400">(désactivée)</span>}
    </h3>
  );
}

function LignePersonne({
  personne,
  interim,
}: {
  personne: Personne;
  interim: boolean;
}): React.JSX.Element {
  return (
    <li className="flex items-center justify-between rounded px-2 py-1">
      <span className={personne.actif ? '' : 'opacity-40'}>
        {personne.prenom} {personne.nom} — {personne.email}
        {interim && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            intérim
          </span>
        )}
      </span>
      {personne.actif && !interim && (
        <Button variante="discret" onClick={() => desactiverPersonne(personne.id)}>
          Désactiver
        </Button>
      )}
    </li>
  );
}

export function Organigramme(): React.JSX.Element {
  const { t } = useTranslation();
  const entites = useLiveQuery(() => db.entites.toArray()) ?? [];
  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];
  const personnes = useLiveQuery(() => db.personnes.toArray()) ?? [];
  const [onglet, setOnglet] = useState<IdOnglet>('entites');

  const arbre = entitesEnArbre(entites);
  const postesDe = (entiteId: ID) => trierPostes(postes.filter((p) => p.entiteId === entiteId));
  const titulairesDe = (posteId: ID) =>
    trierPersonnes(personnes.filter((p) => p.posteId === posteId));
  const interimairesDe = (posteId: ID) =>
    trierPersonnes(personnes.filter((p) => p.interimPosteIds.includes(posteId)));
  const postesOccupesDe = (entiteId: ID) =>
    postesDe(entiteId).filter(
      (poste) => titulairesDe(poste.id).length + interimairesDe(poste.id).length > 0,
    );
  // Poste absent ou introuvable : la personne n'apparaîtrait sous aucune entité.
  const personnesSansPoste = trierPersonnes(
    personnes.filter((p) => !p.posteId || !postes.some((poste) => poste.id === p.posteId)),
  );

  const nbActifs = (liste: { actif: boolean }[]) => liste.filter((x) => x.actif).length;
  const onglets: Onglet<IdOnglet>[] = [
    { id: 'entites', libelle: `Entités (${nbActifs(entites)})` },
    { id: 'postes', libelle: `Postes (${nbActifs(postes)})` },
    { id: 'personnes', libelle: `Personnes (${nbActifs(personnes)})` },
  ];

  const [codeEntite, setCodeEntite] = useState('');
  const [libelleEntite, setLibelleEntite] = useState('');
  const [typeEntite, setTypeEntite] = useState<TypeEntite>('SERVICE');
  const [parentEntite, setParentEntite] = useState<string>();
  const [edition, setEdition] = useState<(DonneesEntite & { id: ID }) | null>(null);

  const [libellePoste, setLibellePoste] = useState('');
  const [entitePoste, setEntitePoste] = useState<string>();
  const [rolePoste, setRolePoste] = useState<RoleSysteme>('AGENT');
  const [responsable, setResponsable] = useState(false);
  const [peutSigner, setPeutSigner] = useState(false);

  const [prenomPersonne, setPrenomPersonne] = useState('');
  const [nomPersonne, setNomPersonne] = useState('');
  const [emailPersonne, setEmailPersonne] = useState('');
  const [postePersonne, setPostePersonne] = useState<string>();

  async function surCreerEntite() {
    try {
      await creerEntite({
        code: codeEntite,
        libelle: libelleEntite,
        type: typeEntite,
        parentId: parentEntite ?? null,
      });
      setCodeEntite('');
      setLibelleEntite('');
      toastSucces(t('commun.enregistrer'));
    } catch (e) {
      toastErreur(messageErreur(e));
    }
  }

  async function surModifierEntite() {
    if (!edition) return;
    const { id, ...donnees } = edition;
    try {
      await modifierEntite(id, {
        ...donnees,
        code: donnees.code.trim(),
        libelle: donnees.libelle.trim(),
      });
      setEdition(null);
      toastSucces(t('commun.enregistrer'));
    } catch (e) {
      toastErreur(messageErreur(e));
    }
  }

  async function surReactiverEntite(id: ID) {
    try {
      await reactiverEntite(id);
    } catch (e) {
      toastErreur(messageErreur(e));
    }
  }

  async function surCreerPoste() {
    if (!entitePoste) return;
    try {
      await creerPoste({
        libelle: libellePoste,
        entiteId: entitePoste,
        role: rolePoste,
        estResponsable: responsable,
        peutSigner,
      });
      setLibellePoste('');
      toastSucces(t('commun.enregistrer'));
    } catch (e) {
      toastErreur(messageErreur(e));
    }
  }

  async function surCreerPersonne() {
    if (!prenomPersonne || !nomPersonne || !emailPersonne) return;
    try {
      await creerPersonne({
        prenom: prenomPersonne,
        nom: nomPersonne,
        email: emailPersonne,
        posteId: postePersonne ?? null,
      });
      setPrenomPersonne('');
      setNomPersonne('');
      setEmailPersonne('');
      toastSucces(t('commun.enregistrer'));
    } catch (e) {
      toastErreur(messageErreur(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        {t('nav.administration')} — Organigramme
      </h1>

      <Tabs onglets={onglets} actif={onglet} onChange={setOnglet} />

      {onglet === 'entites' && (
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <input
              className="champ"
              placeholder="Code"
              value={codeEntite}
              onChange={(e) => setCodeEntite(e.target.value)}
            />
            <input
              className="champ"
              placeholder="Libellé"
              value={libelleEntite}
              onChange={(e) => setLibelleEntite(e.target.value)}
            />
            <select
              className="champ"
              value={typeEntite}
              onChange={(e) => setTypeEntite(e.target.value as TypeEntite)}
            >
              {typesEntite.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <SelecteurEntite
              valeur={parentEntite}
              onChange={setParentEntite}
              placeholder="Entité parente (racine si vide)"
            />
          </div>
          <Button
            variante="primaire"
            disabled={!codeEntite || !libelleEntite}
            onClick={surCreerEntite}
          >
            Ajouter l'entité
          </Button>
          <div className="mt-4 space-y-4">
            {typesEntite
              .map((type) => ({
                type,
                liste: arbre.map(({ entite }) => entite).filter((e) => e.type === type),
              }))
              .filter(({ liste }) => liste.length > 0)
              .map(({ type, liste }) => (
                <div key={type} className="space-y-1">
                  <h3 className="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {libellesTypeEntite[type]} ({liste.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {liste.map((e) =>
                      edition?.id === e.id ? (
                        <li
                          key={e.id}
                          className="grid grid-cols-2 gap-2 rounded bg-slate-50 p-2 md:grid-cols-[8rem_1fr_10rem_1fr_auto] dark:bg-slate-800"
                        >
                          <input
                            className="champ"
                            placeholder="Code"
                            value={edition.code}
                            onChange={(ev) => setEdition({ ...edition, code: ev.target.value })}
                          />
                          <input
                            className="champ"
                            placeholder="Libellé"
                            value={edition.libelle}
                            onChange={(ev) => setEdition({ ...edition, libelle: ev.target.value })}
                          />
                          <select
                            className="champ"
                            value={edition.type}
                            onChange={(ev) =>
                              setEdition({ ...edition, type: ev.target.value as TypeEntite })
                            }
                          >
                            {typesEntite.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <SelecteurEntite
                            valeur={edition.parentId ?? undefined}
                            onChange={(parentId) => setEdition({ ...edition, parentId })}
                            placeholder="Racine (aucune entité parente)"
                          />
                          <div className="col-span-2 flex gap-2 md:col-span-1">
                            <Button
                              variante="primaire"
                              disabled={!edition.code.trim() || !edition.libelle.trim()}
                              onClick={surModifierEntite}
                            >
                              {t('commun.enregistrer')}
                            </Button>
                            <Button variante="discret" onClick={() => setEdition(null)}>
                              {t('commun.annuler')}
                            </Button>
                          </div>
                        </li>
                      ) : (
                        <li
                          key={e.id}
                          className="flex items-center justify-between rounded px-2 py-1"
                        >
                          <span className={e.actif ? '' : 'opacity-40'}>
                            {e.code} — {e.libelle}
                            {e.parentId && (
                              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                rattachée à{' '}
                                {entites.find((x) => x.id === e.parentId)?.libelle ?? '?'}
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variante="discret"
                              onClick={() =>
                                setEdition({
                                  id: e.id,
                                  code: e.code,
                                  libelle: e.libelle,
                                  type: e.type,
                                  parentId: e.parentId,
                                })
                              }
                            >
                              Modifier
                            </Button>
                            {e.actif ? (
                              <Button variante="discret" onClick={() => desactiverEntite(e.id)}>
                                Désactiver
                              </Button>
                            ) : (
                              <Button variante="discret" onClick={() => surReactiverEntite(e.id)}>
                                Réactiver
                              </Button>
                            )}
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}

      {onglet === 'postes' && (
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <input
              className="champ"
              placeholder="Libellé"
              value={libellePoste}
              onChange={(e) => setLibellePoste(e.target.value)}
            />
            <SelecteurEntite valeur={entitePoste} onChange={setEntitePoste} placeholder="Entité" />
            <select
              className="champ"
              value={rolePoste}
              onChange={(e) => setRolePoste(e.target.value as RoleSysteme)}
            >
              {roles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={responsable}
                  onChange={(e) => setResponsable(e.target.checked)}
                />{' '}
                Resp.
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={peutSigner}
                  onChange={(e) => setPeutSigner(e.target.checked)}
                />{' '}
                Signe
              </label>
            </div>
          </div>
          <Button
            variante="primaire"
            disabled={!libellePoste || !entitePoste}
            onClick={surCreerPoste}
          >
            Ajouter le poste
          </Button>
          <div className="mt-4 space-y-4">
            {arbre
              .filter(({ entite }) => postesDe(entite.id).length > 0)
              .map(({ entite, profondeur }) => (
                <div key={entite.id} className="space-y-1">
                  <EnTeteEntite entite={entite} profondeur={profondeur} />
                  <ul
                    className="space-y-1 text-sm"
                    style={{ paddingLeft: retrait(profondeur + 1) }}
                  >
                    {postesDe(entite.id).map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between rounded px-2 py-1"
                      >
                        <span className={p.actif ? '' : 'opacity-40'}>
                          {p.libelle} — {p.role}
                          {p.estResponsable ? ' · resp.' : ''}
                          {p.peutSigner ? ' · signe' : ''}
                        </span>
                        {p.actif && (
                          <Button variante="discret" onClick={() => desactiverPoste(p.id)}>
                            Désactiver
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}

      {onglet === 'personnes' && (
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <input
              className="champ"
              placeholder="Prénom"
              value={prenomPersonne}
              onChange={(e) => setPrenomPersonne(e.target.value)}
            />
            <input
              className="champ"
              placeholder="Nom"
              value={nomPersonne}
              onChange={(e) => setNomPersonne(e.target.value)}
            />
            <input
              className="champ"
              placeholder="E-mail"
              value={emailPersonne}
              onChange={(e) => setEmailPersonne(e.target.value)}
            />
            <select
              className="champ"
              value={postePersonne ?? ''}
              onChange={(e) => setPostePersonne(e.target.value)}
            >
              <option value="">Sans poste</option>
              {arbre
                .filter(({ entite }) => entite.actif && postesDe(entite.id).some((p) => p.actif))
                .map(({ entite }) => (
                  <optgroup key={entite.id} label={entite.libelle}>
                    {postesDe(entite.id)
                      .filter((p) => p.actif)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.libelle}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </select>
          </div>
          <Button
            variante="primaire"
            disabled={!prenomPersonne || !nomPersonne || !emailPersonne}
            onClick={surCreerPersonne}
          >
            Ajouter la personne
          </Button>
          <div className="mt-4 space-y-4">
            {arbre
              .filter(({ entite }) => postesOccupesDe(entite.id).length > 0)
              .map(({ entite, profondeur }) => (
                <div key={entite.id} className="space-y-2">
                  <EnTeteEntite entite={entite} profondeur={profondeur} />
                  {postesOccupesDe(entite.id).map((poste) => (
                    <div key={poste.id} style={{ paddingLeft: retrait(profondeur + 1) }}>
                      <h4
                        className={`text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400 ${poste.actif ? '' : 'opacity-40'}`}
                      >
                        {poste.libelle}
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {titulairesDe(poste.id).map((p) => (
                          <LignePersonne key={p.id} personne={p} interim={false} />
                        ))}
                        {interimairesDe(poste.id).map((p) => (
                          <LignePersonne key={`${p.id}-interim`} personne={p} interim />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            {personnesSansPoste.length > 0 && (
              <div className="space-y-1">
                <h3 className="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  Sans poste
                </h3>
                <ul className="space-y-1 text-sm" style={{ paddingLeft: retrait(1) }}>
                  {personnesSansPoste.map((p) => (
                    <LignePersonne key={p.id} personne={p} interim={false} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

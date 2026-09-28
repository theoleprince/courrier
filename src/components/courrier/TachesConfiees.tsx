import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Check, CornerDownRight, FilePen, FileText, Send, ThumbsDown, ThumbsUp, Undo2, UserPlus } from 'lucide-react';
import { db } from '@/db/db';
import type { ActeurCourant } from '@/hooks/useActeur';
import { annulerTache, confierTache, natureDe, naturesPossibles, rendreCompte } from '@/services/taches';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelecteurPoste } from '@/components/organisation/SelecteurPoste';
import type { CircuitInstance, Courrier, NatureTache, TacheConfiee } from '@/types/models';

interface Props {
  courrier: Courrier;
  circuit: CircuitInstance | undefined;
  acteur: ActeurCourant;
}

const STYLE_AVIS = {
  FAVORABLE: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  DEFAVORABLE: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

/**
 * Note + imputation interne : le titulaire de l'étape confie le travail à un
 * autre poste avec une instruction ; le destinataire fait ce que l'instruction
 * demande et rend compte ; l'étape reste au titulaire.
 */
export function TachesConfiees({ courrier, circuit, acteur }: Props): React.JSX.Element | null {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'en' ? enUS : fr;
  const natures = naturesPossibles(courrier.sens);

  const [ouvrirConfier, setOuvrirConfier] = useState(false);
  const [posteId, setPosteId] = useState<string>();
  const [nature, setNature] = useState<NatureTache>(natures[0]);
  const [note, setNote] = useState('');
  const [delai, setDelai] = useState('');
  const [compteRendu, setCompteRendu] = useState('');
  const [fichier, setFichier] = useState<File>();
  const [versionCorrigee, setVersionCorrigee] = useState<File>();
  const [avis, setAvis] = useState<'FAVORABLE' | 'DEFAVORABLE'>();
  const [enCours, setEnCours] = useState(false);

  const taches = useLiveQuery(() => db.tachesConfiees.where('courrierId').equals(courrier.id).toArray(), [courrier.id]) ?? [];
  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];
  const personnes = useLiveQuery(() => db.personnes.toArray()) ?? [];
  // Ce que les tâches ont produit : projets de réponse et versions corrigées.
  const produits = useLiveQuery(async () => {
    const idsSortants = taches.map((x) => x.sortantProduitId).filter((id): id is string => !!id);
    const idsPieces = taches.map((x) => x.pieceProduiteId).filter((id): id is string => !!id);
    const [sortants, pieces] = await Promise.all([db.courriers.bulkGet(idsSortants), db.piecesJointes.bulkGet(idsPieces)]);
    return {
      sortants: new Map(sortants.filter((c) => !!c).map((c) => [c!.id, c!])),
      pieces: new Map(pieces.filter((p) => !!p).map((p) => [p!.id, p!])),
    };
  }, [taches.map((x) => `${x.id}:${x.sortantProduitId}:${x.pieceProduiteId}`).join('|')]);

  const libellePoste = (id: string) => postes.find((p) => p.id === id)?.libelle ?? '';
  const nomPersonne = (id?: string) => {
    const p = personnes.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : '';
  };

  const etape = circuit?.statut === 'EN_COURS' ? circuit.etapes[circuit.indexCourant] : undefined;
  const titulaire = !!etape && etape.statut === 'EN_COURS' && etape.posteAssigneId === acteur.poste.id;
  const aMoi = taches.filter((x) => x.statut === 'EN_COURS' && x.posteDestinataireId === acteur.poste.id);
  const triees = [...taches].sort((a, b) => b.confieeLe.localeCompare(a.confieeLe));

  if (!titulaire && aMoi.length === 0 && taches.length === 0) return null;

  const auteur = { personneId: acteur.personne.id, posteId: acteur.poste.id };
  const versFichier = (f: File) => ({ blob: f, nom: f.name, mime: f.type || 'application/octet-stream' });

  async function executer(action: () => Promise<unknown>, succes: string, apres?: () => void) {
    setEnCours(true);
    try {
      await action();
      toastSucces(succes);
      apres?.();
    } catch (e) {
      toastErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const surConfier = () =>
    circuit &&
    posteId &&
    executer(
      () => confierTache(circuit.id, auteur, { posteDestinataireId: posteId, note, nature, delaiJours: delai ? Number(delai) : undefined }),
      t('taches.confiee', { poste: libellePoste(posteId) }),
      () => {
        setOuvrirConfier(false);
        setNote('');
        setDelai('');
        setPosteId(undefined);
        setNature(natures[0]);
      },
    );

  const surRendreCompte = (tache: TacheConfiee) =>
    executer(
      () =>
        rendreCompte(tache.id, auteur, {
          texte: compteRendu,
          fichier: fichier ? versFichier(fichier) : undefined,
          avis,
          versionCorrigee: versionCorrigee ? { ...versFichier(versionCorrigee), mime: versionCorrigee.type || 'application/pdf' } : undefined,
        }),
      t(natureDe(tache) === 'POUR_INFORMATION' ? 'taches.vuEnvoye' : 'taches.compteRenduEnvoye'),
      () => {
        setCompteRendu('');
        setFichier(undefined);
        setVersionCorrigee(undefined);
        setAvis(undefined);
      },
    );

  /** Ce que la tâche a produit, affiché au retour chez le demandeur. */
  function produit(tache: TacheConfiee): React.JSX.Element | null {
    const sortant = tache.sortantProduitId ? produits?.sortants.get(tache.sortantProduitId) : undefined;
    const piece = tache.pieceProduiteId ? produits?.pieces.get(tache.pieceProduiteId) : undefined;
    if (!sortant && !piece && !tache.avis) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tache.avis && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE_AVIS[tache.avis]}`}>
            {tache.avis === 'FAVORABLE' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />} {t(`taches.avis.${tache.avis}`)}
          </span>
        )}
        {piece && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--bordure)] bg-[var(--surface)] px-2 py-1 text-xs">
            <FileText size={12} /> {t('taches.versionCorrigeeProduite', { nom: piece.nom, version: piece.version })}
          </span>
        )}
        {sortant && (
          <button
            type="button"
            onClick={() => navigate(`/courriers/${sortant.id}`)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--bordure)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--couleur-primaire)] hover:bg-[var(--primaire-doux)]"
          >
            <FilePen size={12} /> {t('taches.projetProduit', { objet: sortant.objet })}
          </button>
        )}
      </div>
    );
  }

  /** Formulaire du destinataire, adapté à l'instruction reçue. */
  function actionsDestinataire(tache: TacheConfiee): React.JSX.Element {
    const n = natureDe(tache);
    const projet = tache.sortantProduitId ? produits?.sortants.get(tache.sortantProduitId) : undefined;

    if (n === 'POUR_INFORMATION') {
      return (
        <Button variante="primaire" disabled={enCours} onClick={() => surRendreCompte(tache)}>
          <Check size={16} /> {t('taches.vu')}
        </Button>
      );
    }

    const pret =
      n === 'POUR_AVIS'
        ? !!avis && !!compteRendu.trim()
        : n === 'CORRIGER_DOCUMENT'
          ? !!versionCorrigee
          : n === 'PROJET_REPONSE'
            ? !!projet
            : !!compteRendu.trim();

    return (
      <div className="space-y-2">
        {n === 'PROJET_REPONSE' &&
          (projet ? (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <button
                type="button"
                onClick={() => navigate(`/courriers/${projet.id}`)}
                className="inline-flex items-center gap-1 font-medium text-[var(--couleur-primaire)] hover:underline"
              >
                <FilePen size={14} /> {t('taches.projetProduit', { objet: projet.objet })}
              </button>
            </p>
          ) : (
            <Button
              variante="primaire"
              onClick={() => navigate(`/courriers/sortants/nouveau?enReponseA=${courrier.id}&tache=${tache.id}`)}
            >
              <FilePen size={16} /> {t('taches.redigerProjet')}
            </Button>
          ))}

        {n === 'CORRIGER_DOCUMENT' && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--couleur-primaire)] px-3 py-2 text-sm font-medium text-[var(--couleur-primaire)] hover:bg-[var(--primaire-doux)]">
            <FileText size={16} /> {versionCorrigee ? versionCorrigee.name : t('taches.deposerVersionCorrigee')}
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setVersionCorrigee(e.target.files?.[0])} />
          </label>
        )}

        {n === 'POUR_AVIS' && (
          <div className="flex gap-2" role="radiogroup" aria-label={t('taches.votreAvis') ?? undefined}>
            {(['FAVORABLE', 'DEFAVORABLE'] as const).map((valeur) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={avis === valeur}
                onClick={() => setAvis(valeur)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  avis === valeur ? `${STYLE_AVIS[valeur]} border-transparent` : 'border-[var(--bordure)] text-slate-600 dark:text-slate-300'
                }`}
              >
                {valeur === 'FAVORABLE' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />} {t(`taches.avis.${valeur}`)}
              </button>
            ))}
          </div>
        )}

        <textarea
          className="champ"
          rows={3}
          value={compteRendu}
          onChange={(e) => setCompteRendu(e.target.value)}
          placeholder={t(n === 'POUR_AVIS' ? 'taches.motivationPlaceholder' : 'taches.compteRenduPlaceholder') ?? undefined}
        />
        <div className="flex flex-wrap items-center gap-2">
          {n === 'SUITE_A_DONNER' && (
            <label className="cursor-pointer rounded-lg border border-[var(--bordure)] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              {fichier ? fichier.name : t('taches.joindre')}
              <input type="file" className="hidden" onChange={(e) => setFichier(e.target.files?.[0])} />
            </label>
          )}
          <Button variante="primaire" disabled={enCours || !pret} onClick={() => surRendreCompte(tache)}>
            <Send size={16} /> {t(n === 'POUR_AVIS' ? 'taches.donnerAvis' : 'taches.rendreCompte')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('taches.titre')}</h3>
        {titulaire && (
          <Button variante="secondaire" onClick={() => setOuvrirConfier(true)}>
            <UserPlus size={16} /> {t('taches.confier')}
          </Button>
        )}
      </div>
      {titulaire && taches.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{t('taches.aide')}</p>}

      {/* Ce qu'on m'a confié : je fais ce que l'instruction demande, puis je rends compte. */}
      {aMoi.map((tache) => (
        <div key={tache.id} className="space-y-2 rounded-lg border-2 border-[var(--couleur-primaire)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--couleur-primaire)]">
            {t('taches.confieeParPoste', { poste: libellePoste(tache.posteSourceId), personne: nomPersonne(tache.confieeParId) })}
          </p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`taches.nature.${natureDe(tache)}`)}</p>
          <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">« {tache.note} »</p>
          {tache.echeance && (
            <p className="text-xs text-slate-500">{t('taches.echeance', { date: format(new Date(tache.echeance), 'P', { locale }) })}</p>
          )}
          {actionsDestinataire(tache)}
        </div>
      ))}

      {/* Historique des tâches confiées sur ce courrier */}
      {triees.length > 0 && (
        <ul className="space-y-2">
          {triees.map((tache) => (
            <li key={tache.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {libellePoste(tache.posteSourceId)} → {libellePoste(tache.posteDestinataireId)}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tache.statut === 'EN_COURS'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : tache.statut === 'RENDUE'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t(`taches.statut.${tache.statut}`)}
                  </span>
                  {tache.statut === 'EN_COURS' && tache.posteSourceId === acteur.poste.id && (
                    <button
                      type="button"
                      title={t('taches.annuler') ?? undefined}
                      disabled={enCours}
                      onClick={() => executer(() => annulerTache(tache.id, auteur), t('taches.annulee'))}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--bordure)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-slate-600 hover:border-red-300 hover:text-red-600 dark:text-slate-300"
                    >
                      <Undo2 size={13} /> {t('taches.reprendre')}
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`taches.nature.${natureDe(tache)}`)}</p>
              <p className="mt-0.5 whitespace-pre-line text-slate-600 dark:text-slate-300">« {tache.note} »</p>
              <p className="mt-1 text-xs text-slate-400">
                {nomPersonne(tache.confieeParId)} · {format(new Date(tache.confieeLe), 'Pp', { locale })}
              </p>
              {tache.compteRendu && (
                <div className="mt-2 flex gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <CornerDownRight size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{tache.compteRendu}</p>
                    {produit(tache)}
                    <p className="mt-1 text-xs text-slate-400">
                      {nomPersonne(tache.clotureeParId)} · {tache.clotureeLe && format(new Date(tache.clotureeLe), 'Pp', { locale })}
                      {tache.pieceJointeId && ` · ${t('taches.pieceJointe')}`}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {ouvrirConfier && (
        <Modal titre={t('taches.confier')} onFermer={() => setOuvrirConfier(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('taches.aide')}</p>
            <SelecteurPoste valeur={posteId} onChange={setPosteId} placeholder={t('taches.choisirPoste') ?? undefined} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('taches.instruction')}</span>
              <select className="champ" value={nature} onChange={(e) => setNature(e.target.value as NatureTache)}>
                {natures.map((n) => (
                  <option key={n} value={n}>
                    {t(`taches.nature.${n}`)}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className="champ"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('taches.notePlaceholder') ?? undefined}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              {t('taches.delai')}
              <input type="number" min={1} className="champ w-24" value={delai} onChange={(e) => setDelai(e.target.value)} />
              {t('taches.jours')}
            </label>
            <Button
              variante="primaire"
              disabled={enCours || !posteId || posteId === acteur.poste.id || !note.trim()}
              onClick={surConfier}
            >
              <UserPlus size={16} /> {t('taches.confier')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

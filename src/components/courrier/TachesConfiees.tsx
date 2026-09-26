import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { CornerDownRight, Send, UserPlus, X } from 'lucide-react';
import { db } from '@/db/db';
import type { ActeurCourant } from '@/hooks/useActeur';
import { annulerTache, confierTache, rendreCompte } from '@/services/taches';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelecteurPoste } from '@/components/organisation/SelecteurPoste';
import type { CircuitInstance, Courrier, TacheConfiee } from '@/types/models';

interface Props {
  courrier: Courrier;
  circuit: CircuitInstance | undefined;
  acteur: ActeurCourant;
}

/**
 * Note + imputation interne : le titulaire de l'étape confie le travail à un
 * autre poste ; le destinataire rend compte ; l'étape reste au titulaire.
 */
export function TachesConfiees({ courrier, circuit, acteur }: Props): React.JSX.Element | null {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const [ouvrirConfier, setOuvrirConfier] = useState(false);
  const [posteId, setPosteId] = useState<string>();
  const [note, setNote] = useState('');
  const [delai, setDelai] = useState('');
  const [compteRendu, setCompteRendu] = useState('');
  const [fichier, setFichier] = useState<File>();
  const [enCours, setEnCours] = useState(false);

  const taches = useLiveQuery(() => db.tachesConfiees.where('courrierId').equals(courrier.id).toArray(), [courrier.id]) ?? [];
  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];
  const personnes = useLiveQuery(() => db.personnes.toArray()) ?? [];
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
      () => confierTache(circuit.id, auteur, { posteDestinataireId: posteId, note, delaiJours: delai ? Number(delai) : undefined }),
      t('taches.confiee', { poste: libellePoste(posteId) }),
      () => {
        setOuvrirConfier(false);
        setNote('');
        setDelai('');
        setPosteId(undefined);
      },
    );

  const surRendreCompte = (tache: TacheConfiee) =>
    executer(
      () =>
        rendreCompte(tache.id, auteur, {
          texte: compteRendu,
          fichier: fichier ? { blob: fichier, nom: fichier.name, mime: fichier.type || 'application/octet-stream' } : undefined,
        }),
      t('taches.compteRenduEnvoye'),
      () => {
        setCompteRendu('');
        setFichier(undefined);
      },
    );

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

      {/* Ce qu'on m'a confié : je rends compte */}
      {aMoi.map((tache) => (
        <div key={tache.id} className="space-y-2 rounded-lg border-2 border-[var(--couleur-primaire)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--couleur-primaire)]">
            {t('taches.confieeParPoste', { poste: libellePoste(tache.posteSourceId), personne: nomPersonne(tache.confieeParId) })}
          </p>
          <p className="whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">« {tache.note} »</p>
          {tache.echeance && (
            <p className="text-xs text-slate-500">{t('taches.echeance', { date: format(new Date(tache.echeance), 'P', { locale }) })}</p>
          )}
          <textarea
            className="champ"
            rows={3}
            value={compteRendu}
            onChange={(e) => setCompteRendu(e.target.value)}
            placeholder={t('taches.compteRenduPlaceholder') ?? undefined}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-[var(--bordure)] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              {fichier ? fichier.name : t('taches.joindre')}
              <input type="file" className="hidden" onChange={(e) => setFichier(e.target.files?.[0])} />
            </label>
            <Button variante="primaire" disabled={enCours || !compteRendu.trim()} onClick={() => surRendreCompte(tache)}>
              <Send size={16} /> {t('taches.rendreCompte')}
            </Button>
          </div>
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
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">« {tache.note} »</p>
              <p className="mt-1 text-xs text-slate-400">
                {nomPersonne(tache.confieeParId)} · {format(new Date(tache.confieeLe), 'Pp', { locale })}
              </p>
              {tache.compteRendu && (
                <div className="mt-2 flex gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <CornerDownRight size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{tache.compteRendu}</p>
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

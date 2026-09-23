import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { ActeurCourant } from '@/hooks/useActeur';
import {
  validerEtape,
  viser,
  rejeterEtape,
  signer,
  signerManuscrit,
  validerManuscrit,
  documentDeTravail,
  expedier,
  commenter,
  diffuser,
  archiver,
  ajouterAnnexe,
  soumettreSortant,
  suggererImputation,
  type SuggestionImputation,
} from '@/services/workflow';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { ouvrirPdf } from '@/services/impression';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelecteurEntite } from '@/components/organisation/SelecteurEntite';
import { PadSignature } from '@/components/courrier/PadSignature';
import type { CircuitInstance, Courrier, ModeEnvoi } from '@/types/models';
import { origineApp } from '@/services/urls';

interface Props {
  courrier: Courrier;
  circuit: CircuitInstance | undefined;
  acteur: ActeurCourant;
}

const modesEnvoi: ModeEnvoi[] = ['MAIN_PROPRE', 'POSTE', 'EMAIL', 'COURSIER'];

export function PanneauActions({ courrier, circuit, acteur }: Props): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [commentaire, setCommentaire] = useState('');
  const [entiteTraitanteId, setEntiteTraitanteId] = useState<string>();
  const [suggestions, setSuggestions] = useState<SuggestionImputation[]>([]);
  const [ouvrirRejet, setOuvrirRejet] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [ouvrirSignature, setOuvrirSignature] = useState(false);
  const [ouvrirVisa, setOuvrirVisa] = useState(false);
  const [ouvrirDiffusion, setOuvrirDiffusion] = useState(false);
  const [posteDiffusion, setPosteDiffusion] = useState<string>();
  const [modeEnvoi, setModeEnvoi] = useState<ModeEnvoi>('POSTE');
  const [accuseReception, setAccuseReception] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];

  const etape = circuit && circuit.statut === 'EN_COURS' ? circuit.etapes[circuit.indexCourant] : undefined;
  const assigneAMoi = etape?.posteAssigneId === acteur.poste.id;

  async function chargerSuggestions() {
    setSuggestions(await suggererImputation(courrier.id));
  }

  function gererErreur(erreur: unknown) {
    toastErreur(messageErreur(erreur));
  }

  async function surImputer() {
    if (!circuit || !entiteTraitanteId) return;
    setEnCours(true);
    try {
      await validerEtape(circuit.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { entiteTraitanteId, commentaire: commentaire || undefined });
      toastSucces(t('courrier.imputer'));
      setCommentaire('');
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surValider() {
    if (!circuit) return;
    setEnCours(true);
    try {
      await validerEtape(circuit.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { commentaire: commentaire || undefined });
      toastSucces(t('commun.confirmer'));
      setCommentaire('');
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surViser(paraphePngDataUrl: string) {
    if (!circuit) return;
    setEnCours(true);
    try {
      await viser(circuit.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { commentaire: commentaire || undefined, paraphePngDataUrl });
      toastSucces(t('courrier.visaAppose'));
      setCommentaire('');
      setOuvrirVisa(false);
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surRejeter() {
    if (!circuit || !motifRejet.trim()) return;
    setEnCours(true);
    try {
      await rejeterEtape(circuit.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, motifRejet);
      toastSucces(t('courrier.rejeter'));
      setOuvrirRejet(false);
      setMotifRejet('');
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surSigner(imagePngDataUrl: string) {
    if (!circuit) return;
    setEnCours(true);
    try {
      await signer(circuit.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { imagePngDataUrl, origineUrl: origineApp() });
      toastSucces(t('signature.confirmer'));
      setOuvrirSignature(false);
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surImprimerDocument() {
    const document = await documentDeTravail(courrier.id);
    if (!document) {
      toastErreur(t('erreurs.documentIntrouvable'));
      return;
    }
    ouvrirPdf(document.contenu);
  }

  async function surTeleverserScan(fichier: File | undefined) {
    if (!circuit || !fichier || !etape) return;
    setEnCours(true);
    try {
      const auteur = { personneId: acteur.personne.id, posteId: acteur.poste.id };
      const scan = { blob: fichier, nom: fichier.name, mime: fichier.type };
      if (etape.type === 'SIGNATURE') {
        await signerManuscrit(circuit.id, auteur, scan);
        toastSucces(t('signature.manuscriteEnregistree'));
      } else {
        await validerManuscrit(circuit.id, auteur, scan, commentaire || undefined);
        toastSucces(t('manuscrit.enregistre'));
        setCommentaire('');
      }
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  const modaleDiffusion = (
    <>
      {ouvrirDiffusion && (
        <Modal titre={t('courrier.diffuserPourInformation')} onFermer={() => setOuvrirDiffusion(false)}>
          <div className="space-y-3">
            <select className="champ" value={posteDiffusion ?? ''} onChange={(e) => setPosteDiffusion(e.target.value)}>
              <option value="" disabled>
                {t('courrier.diffuserPourInformation')}
              </option>
              {postes.filter((p) => p.actif).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                </option>
              ))}
            </select>
            <Button variante="primaire" disabled={!posteDiffusion || enCours} onClick={surDiffuser}>
              {t('courrier.diffuserPourInformation')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );

  /** Alternative papier : imprimer le document, le traiter à la main, téléverser le scan. */
  const blocManuscrit = (
    <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {t(etape?.type === 'SIGNATURE' ? 'signature.manuscriteTitre' : etape?.type === 'VISA' ? 'manuscrit.titreVisa' : 'manuscrit.titreValidation')}
      </p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {t(etape?.type === 'SIGNATURE' ? 'signature.manuscriteExplication' : 'manuscrit.explication')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variante="secondaire" onClick={surImprimerDocument}>
          {t('manuscrit.imprimer')}
        </Button>
        <label
          className={`cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 ${enCours ? 'pointer-events-none opacity-50' : ''}`}
        >
          {t('manuscrit.televerser')}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              void surTeleverserScan(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );

  async function surExpedier() {
    setEnCours(true);
    try {
      const resultat = await expedier(courrier.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { modeEnvoi, accuseReception });
      toastSucces(t('courrier.courrierEnregistre', { numero: resultat.numero }));
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surCommenter() {
    if (!commentaire.trim()) return;
    setEnCours(true);
    try {
      await commenter(courrier.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, commentaire);
      setCommentaire('');
      toastSucces(t('courrier.commentaire'));
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surDiffuser() {
    if (!posteDiffusion) return;
    setEnCours(true);
    try {
      await diffuser(courrier.id, posteDiffusion, { personneId: acteur.personne.id, posteId: acteur.poste.id });
      toastSucces(t('courrier.diffuserPourInformation'));
      setOuvrirDiffusion(false);
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surArchiver() {
    setEnCours(true);
    try {
      await archiver(courrier.id, { personneId: acteur.personne.id, posteId: acteur.poste.id });
      toastSucces(t('courrier.archiver'));
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surAjouterAnnexe(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    try {
      await ajouterAnnexe(courrier.id, { personneId: acteur.personne.id, posteId: acteur.poste.id }, { blob: fichier, nom: fichier.name, mime: fichier.type });
      toastSucces(t('courrier.fichier'));
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  async function surResoumettre() {
    setEnCours(true);
    try {
      await soumettreSortant(courrier.id, { personneId: acteur.personne.id, posteId: acteur.poste.id });
      toastSucces(t('courrier.resoumettre'));
    } catch (e) {
      gererErreur(e);
    } finally {
      setEnCours(false);
    }
  }

  const boiteCommentaire = (
    <textarea
      value={commentaire}
      onChange={(e) => setCommentaire(e.target.value)}
      placeholder={t('courrier.commentaire') ?? undefined}
      rows={2}
      className="champ mb-2"
    />
  );

  if (assigneAMoi && etape) {
    if (etape.type === 'IMPUTATION') {
      return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('courrier.imputer')}</h3>
          <Button variante="discret" type="button" onClick={chargerSuggestions} className="text-xs">
            {t('courrier.suggestions')}
          </Button>
          {suggestions.length > 0 && (
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li key={s.entiteId}>
                  <button
                    type="button"
                    onClick={() => setEntiteTraitanteId(s.entiteId)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-left text-sm hover:border-[var(--couleur-primaire)] dark:border-slate-700"
                  >
                    <EntiteLabel entiteId={s.entiteId} />
                    <span className="block text-xs text-slate-400">{s.justification}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <SelecteurEntite valeur={entiteTraitanteId} onChange={setEntiteTraitanteId} placeholder={t('courrier.entiteTraitante') ?? undefined} />
          {boiteCommentaire}
          <div className="flex flex-wrap gap-2">
            <Button variante="primaire" disabled={!entiteTraitanteId || enCours} onClick={surImputer}>
              {t('courrier.imputer')}
            </Button>
            <Button variante="secondaire" onClick={() => setOuvrirDiffusion(true)}>
              {t('courrier.diffuserPourInformation')}
            </Button>
          </div>
          {modaleDiffusion}
        </div>
      );
    }

    if (etape.type === 'TRAITEMENT') {
      const entrantReponseAttendue = courrier.sens === 'ENTRANT' && courrier.reponseAttendue;
      return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('courrier.marquerTraite')}</h3>
          {boiteCommentaire}
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
              {t('courrier.fichier')}
              <input type="file" className="hidden" onChange={(e) => surAjouterAnnexe(e.target.files?.[0])} />
            </label>
            {entrantReponseAttendue && (
              <Button variante="secondaire" onClick={() => navigate(`/courriers/sortants/nouveau?enReponseA=${courrier.id}`)}>
                {t('courrier.rediger')}
              </Button>
            )}
            <Button variante="primaire" disabled={enCours} onClick={surValider}>
              {t('courrier.marquerTraite')}
            </Button>
          </div>
        </div>
      );
    }

    if (etape.type === 'VISA' || etape.type === 'VALIDATION') {
      return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">
            {t(etape.type === 'VISA' ? 'courrier.viser' : 'courrier.valider')}
          </h3>
          {boiteCommentaire}
          <div className="flex gap-2">
            <Button variante="primaire" disabled={enCours} onClick={etape.type === 'VISA' ? () => setOuvrirVisa(true) : surValider}>
              {t(etape.type === 'VISA' ? 'courrier.viser' : 'courrier.valider')}
            </Button>
            <Button variante="danger" onClick={() => setOuvrirRejet(true)}>
              {t('courrier.rejeter')}
            </Button>
          </div>
          {blocManuscrit}
          {ouvrirVisa && (
            <Modal titre={t('courrier.viser')} onFermer={() => setOuvrirVisa(false)}>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t('courrier.visaExplication')}</p>
              <PadSignature signatureExistante={acteur.personne.derniereSignaturePng} onValider={surViser} onAnnuler={() => setOuvrirVisa(false)} enCours={enCours} />
            </Modal>
          )}
          {ouvrirRejet && (
            <Modal titre={t('courrier.rejeter')} onFermer={() => setOuvrirRejet(false)}>
              <textarea
                autoFocus
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
                placeholder={t('courrier.motifRejet') ?? undefined}
                rows={3}
                className="champ mb-3"
              />
              <Button variante="danger" disabled={!motifRejet.trim() || enCours} onClick={surRejeter}>
                {t('courrier.rejeter')}
              </Button>
            </Modal>
          )}
        </div>
      );
    }

    if (etape.type === 'SIGNATURE') {
      return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('parapheur.signer')}</h3>
          <div className="flex gap-2">
            <Button variante="primaire" onClick={() => setOuvrirSignature(true)}>
              {t('parapheur.signer')}
            </Button>
            <Button variante="danger" onClick={() => setOuvrirRejet(true)}>
              {t('courrier.rejeter')}
            </Button>
          </div>
          {blocManuscrit}
          {ouvrirSignature && (
            <Modal titre={t('signature.titre')} onFermer={() => setOuvrirSignature(false)}>
              <PadSignature signatureExistante={acteur.personne.derniereSignaturePng} onValider={surSigner} onAnnuler={() => setOuvrirSignature(false)} enCours={enCours} />
            </Modal>
          )}
          {ouvrirRejet && (
            <Modal titre={t('courrier.rejeter')} onFermer={() => setOuvrirRejet(false)}>
              <textarea
                autoFocus
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
                placeholder={t('courrier.motifRejet') ?? undefined}
                rows={3}
                className="champ mb-3"
              />
              <Button variante="danger" disabled={!motifRejet.trim() || enCours} onClick={surRejeter}>
                {t('courrier.rejeter')}
              </Button>
            </Modal>
          )}
        </div>
      );
    }

    if (etape.type === 'EXPEDITION') {
      return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('courrier.expedier')}</h3>
          <select className="champ" value={modeEnvoi} onChange={(e) => setModeEnvoi(e.target.value as ModeEnvoi)}>
            {modesEnvoi.map((m) => (
              <option key={m} value={m}>
                {t(`modeEnvoi.${m}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={accuseReception} onChange={(e) => setAccuseReception(e.target.checked)} />
            {t('courrier.accuseReception')}
          </label>
          <Button variante="primaire" disabled={enCours} onClick={surExpedier}>
            {t('courrier.expedier')}
          </Button>
        </div>
      );
    }
  }

  if (courrier.sens === 'SORTANT' && courrier.statut === 'REJETE' && courrier.creeParId === acteur.personne.id) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <h3 className="font-medium text-red-800 dark:text-red-300">{t('courrier.rejeter')}</h3>
        <Button variante="primaire" disabled={enCours} onClick={surResoumettre}>
          {t('courrier.resoumettre')}
        </Button>
      </div>
    );
  }

  const posteEstBureauOrdre = acteur.poste.role === 'BUREAU_ORDRE';
  const peutArchiver = posteEstBureauOrdre && (courrier.statut === 'CLOTURE' || courrier.statut === 'EXPEDIE');

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="font-medium text-slate-800 dark:text-slate-100">{t('courrier.commentaire')}</h3>
      {boiteCommentaire}
      <div className="flex flex-wrap gap-2">
        <Button variante="secondaire" disabled={enCours} onClick={surCommenter}>
          {t('courrier.commentaire')}
        </Button>
        {(posteEstBureauOrdre || acteur.poste.estResponsable) && (
          <Button variante="secondaire" onClick={() => setOuvrirDiffusion(true)}>
            {t('courrier.diffuserPourInformation')}
          </Button>
        )}
        {peutArchiver && (
          <Button variante="secondaire" disabled={enCours} onClick={surArchiver}>
            {t('courrier.archiver')}
          </Button>
        )}
      </div>
      {modaleDiffusion}
    </div>
  );
}

function EntiteLabel({ entiteId }: { entiteId: string }): React.JSX.Element {
  const entite = useLiveQuery(() => db.entites.get(entiteId), [entiteId]);
  return <span className="font-medium">{entite?.libelle ?? '…'}</span>;
}

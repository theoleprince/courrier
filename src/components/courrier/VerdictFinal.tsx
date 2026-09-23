import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { CheckCircle2, Hourglass, XCircle } from 'lucide-react';
import { db } from '@/db/db';
import { sortantReponseDe } from '@/services/requetes';
import { statutClair } from '@/services/suivi';
import { BadgeStatut } from '@/components/courrier/Badges';
import type { StatutClair } from '@/services/suivi';
import type { CircuitInstance, Courrier, EtapeInstance, Historique } from '@/types/models';

type Issue = 'favorable' | 'enAttente' | 'defavorable';

/** Issue affichée à partir du statut final du courrier. */
function issueDe(courrier: Courrier): { cle: string; issue: Issue } {
  switch (courrier.statut) {
    case 'CLOTURE':
    case 'ARCHIVE':
      return {
        cle: courrier.sens === 'ENTRANT' ? 'verdict.issue.cloture' : 'verdict.issue.archive',
        issue: 'favorable',
      };
    case 'EXPEDIE':
      return { cle: 'verdict.issue.expedie', issue: 'favorable' };
    case 'EN_ATTENTE_REPONSE':
      return { cle: 'verdict.issue.attenteReponse', issue: 'enAttente' };
    case 'SIGNE':
      return { cle: 'verdict.issue.signe', issue: 'enAttente' };
    case 'REJETE':
      return { cle: 'verdict.issue.rejete', issue: 'defavorable' };
    default:
      return { cle: 'verdict.issue.termine', issue: 'favorable' };
  }
}

const styles: Record<Issue, { cadre: string; icone: React.JSX.Element }> = {
  favorable: {
    cadre:
      'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
    icone: <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />,
  },
  enAttente: {
    cadre:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
    icone: <Hourglass size={20} className="text-amber-600 dark:text-amber-400" />,
  },
  defavorable: {
    cadre:
      'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
    icone: <XCircle size={20} className="text-red-600 dark:text-red-400" />,
  },
};

/** Dernière étape réellement décidée (validée ou rejetée), les étapes ignorées ne comptent pas. */
function derniereDecision(circuit: CircuitInstance): EtapeInstance | undefined {
  return circuit.etapes
    .filter((e) => (e.statut === 'VALIDEE' || e.statut === 'REJETEE') && e.finLe)
    .sort((a, b) => (a.finLe! < b.finLe! ? -1 : 1))
    .at(-1);
}

interface Attente {
  /** Entité chargée de rédiger la réponse (celle à qui le courrier a été imputé). */
  entite: string | undefined;
  dateLimite: string | undefined;
  /** Réponse déjà rédigée : son statut et le poste qui doit agir dessus. */
  reponse?: { numero: string; statut: StatutClair; posteCourant: string | undefined; personneCourante: string | undefined };
}

/** Qui doit agir pour que la réponse parte : l'entité traitante, ou le poste où la réponse est bloquée. */
async function detailsAttente(courrier: Courrier, reponse: Courrier | undefined): Promise<Attente> {
  const entite = courrier.entiteTraitanteId ? (await db.entites.get(courrier.entiteTraitanteId))?.libelle : undefined;
  const dateLimite = courrier.sens === 'ENTRANT' ? courrier.dateLimiteReponse : undefined;
  if (!reponse) return { entite, dateLimite };

  const circuit = reponse.circuitInstanceId ? await db.circuits.get(reponse.circuitInstanceId) : undefined;
  const posteId = circuit?.statut === 'EN_COURS' ? circuit.posteCourantId : null;
  const [poste, occupant] = posteId
    ? await Promise.all([db.postes.get(posteId), db.personnes.where('posteId').equals(posteId).first()])
    : [undefined, undefined];
  return {
    entite,
    dateLimite,
    reponse: {
      numero: reponse.numero ?? reponse.codeSuivi,
      statut: await statutClair(reponse),
      posteCourant: poste?.libelle,
      personneCourante: occupant ? `${occupant.prenom} ${occupant.nom}` : undefined,
    },
  };
}

function AttenteReponse({ attente, avecPersonnes }: { attente: Attente; avecPersonnes: boolean }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const { reponse } = attente;

  return (
    <div className="mt-3 space-y-1 text-sm">
      {!reponse && (
        <p>
          {t('verdict.attente.aucuneReponse')}
          {attente.entite && (
            <>
              {' '}
              {t('verdict.attente.aPreparerPar')} <strong>{attente.entite}</strong>
            </>
          )}
        </p>
      )}
      {reponse && (
        <p className="flex flex-wrap items-center gap-2">
          {t('verdict.attente.reponse', { numero: reponse.numero })} <BadgeStatut statut={reponse.statut} />
          {reponse.posteCourant && (
            <span>
              — {t('verdict.attente.actuellementChez')} <strong>{reponse.posteCourant}</strong>
              {avecPersonnes && reponse.personneCourante && <> ({reponse.personneCourante})</>}
            </span>
          )}
        </p>
      )}
      {attente.dateLimite && (
        <p className="opacity-80">
          {t('verdict.attente.aEnvoyerAvant', { date: format(new Date(attente.dateLimite), 'PP', { locale }) })}
        </p>
      )}
    </div>
  );
}

interface Props {
  courrier: Courrier;
  circuit: CircuitInstance | undefined;
  historique: Historique[];
  /** Faux pour un accès restreint : on n'affiche ni noms ni commentaires. */
  avecPersonnes: boolean;
}

/**
 * Encart « Verdict final » de la fiche détail : affiché dès que le circuit du
 * courrier n'est plus en cours (terminé ou rejeté).
 */
export function VerdictFinal({
  courrier,
  circuit,
  historique,
  avecPersonnes,
}: Props): React.JSX.Element | null {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const decision = circuit ? derniereDecision(circuit) : undefined;

  const reponseAId = courrier.sens === 'SORTANT' ? courrier.reponseAId : null;
  const details = useLiveQuery(async () => {
    const [personne, poste] = await Promise.all([
      decision?.traiteeParId ? db.personnes.get(decision.traiteeParId) : undefined,
      decision?.posteAssigneId ? db.postes.get(decision.posteAssigneId) : undefined,
    ]);
    const lie =
      courrier.sens === 'ENTRANT'
        ? await sortantReponseDe(courrier.id)
        : reponseAId
          ? await db.courriers.get(reponseAId)
          : undefined;
    return { personne, poste, lie, attente: courrier.statut === 'EN_ATTENTE_REPONSE' ? await detailsAttente(courrier, lie) : undefined };
  }, [decision?.traiteeParId, decision?.posteAssigneId, courrier.id, courrier.sens, courrier.statut, reponseAId]);

  if (!circuit || circuit.statut === 'EN_COURS') return null;

  const { cle, issue } = issueDe(courrier);
  const style = styles[issue];
  const nbRejets = historique.filter((h) => h.action === 'REJET').length;
  const etapesEnRetard = circuit.etapes.filter(
    (e) => e.finLe && e.echeance && e.finLe > e.echeance,
  ).length;
  const duree = circuit.termineLe
    ? differenceInCalendarDays(new Date(circuit.termineLe), new Date(circuit.demarreLe))
    : undefined;
  const lie = details?.lie;

  return (
    <section className={`rounded-lg border p-4 ${style.cadre}`} aria-label={t('verdict.titre')}>
      <div className="flex items-center gap-2">
        {style.icone}
        <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
          {t('verdict.titre')}
        </p>
      </div>
      <p className="mt-1 text-lg font-semibold">{t(cle)}</p>

      {decision && (
        <div className="mt-2 text-sm">
          <p>
            {t(
              decision.statut === 'REJETEE'
                ? 'verdict.decision.REJET'
                : `verdict.decision.${decision.type}`,
            )}
            {' · '}
            {decision.libelle}
            {avecPersonnes && details?.personne && (
              <>
                {' '}
                {t('verdict.par')}{' '}
                <strong>
                  {details.personne.prenom} {details.personne.nom}
                </strong>
                {details.poste && <> ({details.poste.libelle})</>}
              </>
            )}
            {decision.finLe && <> — {format(new Date(decision.finLe), 'PPp', { locale })}</>}
          </p>
          {avecPersonnes && decision.commentaire && (
            <blockquote className="mt-2 border-l-2 border-current pl-3 italic opacity-80">
              {decision.statut === 'REJETEE' ? `${t('verdict.motif')} : ` : ''}«{' '}
              {decision.commentaire} »
            </blockquote>
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
        {duree !== undefined && <li>{t('verdict.duree', { count: duree })}</li>}
        <li>
          {etapesEnRetard === 0
            ? t('verdict.delaisTenus')
            : t('verdict.etapesEnRetard', { count: etapesEnRetard })}
        </li>
        {nbRejets > 0 && <li>{t('verdict.rejets', { count: nbRejets })}</li>}
      </ul>

      {details?.attente && <AttenteReponse attente={details.attente} avecPersonnes={avecPersonnes} />}

      {lie && (
        <p className="mt-3 text-sm">
          {t(courrier.sens === 'ENTRANT' ? 'verdict.reponse' : 'verdict.enReponseA')}{' '}
          <Link to={`/courriers/${lie.id}`} className="font-medium underline">
            {lie.numero ?? lie.codeSuivi}
          </Link>
        </p>
      )}
    </section>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox, Send } from 'lucide-react';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { niveauAcces, objetAffiche, sortantReponseDe, type NiveauAcces } from '@/services/requetes';
import { construireParcours, statutClair, type EtapeAffichee, type StatutClair } from '@/services/suivi';
import { BadgeStatut } from '@/components/courrier/Badges';
import { TimelineParcours } from '@/components/courrier/TimelineParcours';
import type { Courrier } from '@/types/models';

interface ElementDossier {
  courrier: Courrier;
  niveau: NiveauAcces;
  statut: StatutClair;
  parcours: EtapeAffichee[];
}

interface Dossier {
  initial: ElementDossier | undefined;
  reponse: ElementDossier | undefined;
}

/**
 * Chaîne « courrier initial → réponse » autour du courrier affiché. Renvoie
 * undefined tant que le chargement est en cours, null si le courrier n'est lié à aucun autre.
 */
function useDossier(courrier: Courrier): Dossier | null | undefined {
  const acteur = useActeur();
  const reponseAId = courrier.sens === 'SORTANT' ? courrier.reponseAId : null;

  return useLiveQuery(async () => {
    if (!acteur) return undefined;
    const [initial, reponse] =
      courrier.sens === 'ENTRANT'
        ? [courrier, await sortantReponseDe(courrier.id)]
        : [reponseAId ? await db.courriers.get(reponseAId) : undefined, courrier];
    if (!initial || !reponse) return null;

    const charger = async (c: Courrier): Promise<ElementDossier> => {
      const niveau = await niveauAcces(c, acteur);
      const circuit = c.circuitInstanceId ? await db.circuits.get(c.circuitInstanceId) : undefined;
      const parcours = circuit && niveau !== 'AUCUN' ? await construireParcours(circuit, niveau !== 'MINIMAL') : [];
      return { courrier: c, niveau, statut: await statutClair(c), parcours };
    };
    const [elementInitial, elementReponse] = await Promise.all([charger(initial), charger(reponse)]);
    return { initial: elementInitial, reponse: elementReponse };
  }, [courrier.id, courrier.statut, courrier.misAJourLe, reponseAId, acteur?.poste.id]);
}

/**
 * Lien compact vers le courrier lié (la réponse depuis l'entrant, l'entrant depuis la
 * réponse), sur une ligne ; le parcours complet du dossier est dans l'onglet Parcours.
 */
export function DossierLie({ courrier }: { courrier: Courrier }): React.JSX.Element | null {
  const { t } = useTranslation();
  const dossier = useDossier(courrier);
  if (!dossier?.initial || !dossier.reponse) return null;

  const role = courrier.sens === 'ENTRANT' ? 'reponse' : 'initial';
  const autre = role === 'reponse' ? dossier.reponse : dossier.initial;
  const restreint = autre.niveau === 'AUCUN';
  const Icone = role === 'initial' ? Inbox : Send;

  return (
    <section
      aria-label={t('dossier.titre')}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700"
    >
      <Icone size={16} className="shrink-0 text-slate-400" />
      <span className="text-slate-500 dark:text-slate-400">{t(`dossier.${role}`)} :</span>
      {restreint ? (
        <span className="text-slate-500">{t('dossier.accesRestreint')}</span>
      ) : (
        <>
          <Link to={`/courriers/${autre.courrier.id}`} className="font-medium text-[var(--couleur-primaire)] hover:underline">
            {autre.courrier.numero ?? autre.courrier.codeSuivi}
          </Link>
          <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
            {objetAffiche(autre.courrier, autre.niveau)}
          </span>
          <BadgeStatut statut={autre.statut} />
        </>
      )}
    </section>
  );
}

/** Onglet Parcours : parcours du courrier seul, ou du dossier complet (initial puis réponse) s'il est lié. */
export function ParcoursDossier({
  courrier,
  parcours,
}: {
  courrier: Courrier;
  parcours: EtapeAffichee[] | undefined;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  const dossier = useDossier(courrier);
  if (!dossier?.initial || !dossier.reponse) return parcours ? <TimelineParcours etapes={parcours} /> : null;

  const sections = [
    { role: 'initial' as const, element: dossier.initial },
    { role: 'reponse' as const, element: dossier.reponse },
  ].filter(({ element }) => element.niveau !== 'AUCUN');

  return (
    <div className="space-y-6">
      {sections.map(({ role, element }) => (
        <div key={role}>
          <h4 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t(`dossier.${role}`)} · {element.courrier.numero ?? element.courrier.codeSuivi}
          </h4>
          {element.parcours.length > 0 ? (
            <TimelineParcours etapes={element.parcours} />
          ) : (
            <p className="text-sm text-slate-400">{t('commun.aucunResultat')}</p>
          )}
        </div>
      ))}
    </div>
  );
}

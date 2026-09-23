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

function LigneDossier({
  element,
  role,
  estCourant,
}: {
  element: ElementDossier;
  role: 'initial' | 'reponse';
  estCourant: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { courrier, niveau, statut } = element;
  const restreint = niveau === 'AUCUN';
  const Icone = role === 'initial' ? Inbox : Send;

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 ${
        estCourant
          ? 'border-[var(--couleur-primaire)] bg-slate-50 dark:bg-slate-800'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icone size={16} className="mt-0.5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t(`dossier.${role}`)} · {courrier.numero ?? courrier.codeSuivi}
            {estCourant && <> · {t('dossier.ceCourrier')}</>}
          </p>
          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {restreint ? t('dossier.accesRestreint') : objetAffiche(courrier, niveau)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!restreint && <BadgeStatut statut={statut} />}
        {!estCourant && !restreint && (
          <Link to={`/courriers/${courrier.id}`} className="text-sm font-medium text-[var(--couleur-primaire)] underline">
            {t('dossier.ouvrir')}
          </Link>
        )}
      </div>
    </li>
  );
}

/** Encart en tête de fiche : le courrier initial et sa réponse, avec lien de l'un vers l'autre. */
export function DossierLie({ courrier }: { courrier: Courrier }): React.JSX.Element | null {
  const { t } = useTranslation();
  const dossier = useDossier(courrier);
  if (!dossier?.initial || !dossier.reponse) return null;

  return (
    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700" aria-label={t('dossier.titre')}>
      <h3 className="mb-2 font-medium text-slate-800 dark:text-slate-100">{t('dossier.titre')}</h3>
      <ul className="space-y-2">
        <LigneDossier element={dossier.initial} role="initial" estCourant={courrier.sens === 'ENTRANT'} />
        <LigneDossier element={dossier.reponse} role="reponse" estCourant={courrier.sens === 'SORTANT'} />
      </ul>
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

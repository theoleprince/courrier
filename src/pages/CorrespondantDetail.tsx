import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { TableCourriers } from '@/components/courrier/TableCourriers';
import { Button } from '@/components/ui/Button';
import type { CourrierEntrant, CourrierSortant } from '@/types/models';

export function CorrespondantDetail(): React.JSX.Element {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const correspondant = useLiveQuery(() => (id ? db.correspondants.get(id) : undefined), [id]);
  const courriers = useLiveQuery(
    () => (id ? db.courriers.where('correspondantId').equals(id).reverse().sortBy('creeLe') : []),
    [id],
  ) ?? [];

  const entrants = courriers.filter((c): c is CourrierEntrant => c.sens === 'ENTRANT');
  const sortants = courriers.filter((c): c is CourrierSortant => c.sens === 'SORTANT');
  const enCours = courriers.filter((c) => !['CLOTURE', 'ARCHIVE', 'EXPEDIE', 'REJETE'].includes(c.statut)).length;
  const enRetard = entrants.filter((c) => c.statut === 'EN_ATTENTE_REPONSE' && c.dateLimiteReponse && new Date(c.dateLimiteReponse) < new Date()).length;

  const delaisReponse = entrants
    .filter((e) => e.statut === 'CLOTURE')
    .map((e) => sortants.find((s) => s.reponseAId === e.id))
    .filter((s): s is CourrierSortant => !!s?.dateExpedition)
    .map((s, i) => {
      const entrant = entrants[i];
      return entrant ? (new Date(s.dateExpedition!).getTime() - new Date(entrant.dateReception).getTime()) / 86_400_000 : 0;
    });
  const delaiMoyen = delaisReponse.length > 0 ? Math.round(delaisReponse.reduce((a, b) => a + b, 0) / delaisReponse.length) : undefined;

  if (!correspondant) return <p>{t('commun.chargement')}</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{correspondant.nom}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[correspondant.organisation, correspondant.adresse, correspondant.telephone, correspondant.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button variante="primaire" onClick={() => navigate(`/courriers/sortants/nouveau?correspondantId=${correspondant.id}`)}>
          {t('courrier.nouveauSortant')}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Reçus" valeur={entrants.length} />
        <Stat label="Envoyés" valeur={sortants.length} />
        <Stat label="En cours" valeur={enCours} />
        <Stat label="En retard" valeur={enRetard} />
        <Stat label="Délai moyen" valeur={delaiMoyen !== undefined ? `${delaiMoyen} j` : '—'} />
      </div>

      <TableCourriers courriers={courriers} />
    </div>
  );
}

function Stat({ label, valeur }: { label: string; valeur: number | string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center dark:border-slate-700">
      <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{valeur}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

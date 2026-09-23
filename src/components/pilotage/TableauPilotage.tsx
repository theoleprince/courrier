import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { maintenant } from '@/services/horloge';
import type { Courrier, CourrierEntrant, CourrierSortant, Entite } from '@/types/models';

function descendantesEtSoi(entiteId: string, entites: Entite[]): Set<string> {
  const resultat = new Set<string>([entiteId]);
  let ajoute = true;
  while (ajoute) {
    ajoute = false;
    for (const e of entites) {
      if (e.parentId && resultat.has(e.parentId) && !resultat.has(e.id)) {
        resultat.add(e.id);
        ajoute = true;
      }
    }
  }
  return resultat;
}

const PALETTE = ['#2563eb', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#64748b'];

export function TableauPilotage(): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const [periodeJours, setPeriodeJours] = useState(30);

  const entites = useLiveQuery(() => db.entites.toArray()) ?? [];
  const courriers = useLiveQuery(() => db.courriers.toArray()) ?? [];
  const circuits = useLiveQuery(() => db.circuits.toArray()) ?? [];

  const perimetre = useMemo(() => {
    if (!acteur) return new Set<string>();
    if (acteur.poste.role === 'DG' || acteur.poste.role === 'ADMIN') return new Set(entites.map((e) => e.id));
    return descendantesEtSoi(acteur.poste.entiteId, entites);
  }, [acteur, entites]);

  const depuis = useMemo(() => {
    const d = maintenant();
    d.setDate(d.getDate() - periodeJours);
    return d;
  }, [periodeJours]);

  const courriersPeriode = useMemo(
    () =>
      courriers.filter(
        (c) => new Date(c.creeLe) >= depuis && (c.entiteTraitanteId ? perimetre.has(c.entiteTraitanteId) : true),
      ),
    [courriers, depuis, perimetre],
  );

  const entrants = courriersPeriode.filter((c): c is CourrierEntrant => c.sens === 'ENTRANT');
  const sortants = courriersPeriode.filter((c): c is CourrierSortant => c.sens === 'SORTANT');

  const circuitsEnCours = circuits.filter((c) => c.statut === 'EN_COURS');
  const enRetard = circuitsEnCours.filter((c) => {
    const etape = c.etapes[c.indexCourant];
    return etape?.echeance && new Date(etape.echeance) < maintenant();
  });

  const cloturesAvecDelai = entrants
    .filter((e) => e.statut === 'CLOTURE' || e.statut === 'ARCHIVE')
    .map((e) => (new Date(e.misAJourLe).getTime() - new Date(e.dateReception).getTime()) / 86_400_000);
  const delaiMoyenTraitement =
    cloturesAvecDelai.length > 0 ? Math.round(cloturesAvecDelai.reduce((a, b) => a + b, 0) / cloturesAvecDelai.length) : undefined;

  const dureesSignature = circuits.flatMap((c) =>
    c.etapes.filter((e) => e.type === 'SIGNATURE' && e.statut === 'VALIDEE' && e.debutLe && e.finLe)
      .map((e) => (new Date(e.finLe!).getTime() - new Date(e.debutLe!).getTime()) / 3_600_000),
  );
  const delaiMoyenSignature =
    dureesSignature.length > 0 ? Math.round(dureesSignature.reduce((a, b) => a + b, 0) / dureesSignature.length) : undefined;

  const tauxDansLesDelais =
    circuitsEnCours.length + enRetard.length > 0
      ? Math.round(((circuitsEnCours.length - enRetard.length) / Math.max(circuitsEnCours.length, 1)) * 100)
      : 100;

  const retardsParEntite = useMemo(() => {
    const compte = new Map<string, number>();
    for (const c of enRetard) {
      const etape = c.etapes[c.indexCourant];
      const posteId = etape?.posteAssigneId;
      if (!posteId) continue;
      compte.set(posteId, (compte.get(posteId) ?? 0) + 1);
    }
    return [...compte.entries()].map(([posteId, valeur]) => ({ posteId, valeur }));
  }, [enRetard]);

  const [postesMap, setPostesMap] = useState<Map<string, string>>(new Map());
  useLiveQuery(async () => {
    const postes = await db.postes.toArray();
    setPostesMap(new Map(postes.map((p) => [p.id, p.libelle])));
  }, []);

  const donneesRetards = retardsParEntite.map((r) => ({ nom: postesMap.get(r.posteId) ?? '…', valeur: r.valeur }));

  const donneesTypes = useMemo(() => {
    const compte = new Map<string, number>();
    for (const c of courriersPeriode) compte.set(c.type, (compte.get(c.type) ?? 0) + 1);
    return [...compte.entries()].map(([type, valeur]) => ({ nom: t(`typeCourrier.${type}`), valeur }));
  }, [courriersPeriode, t]);

  const dixPlusEnRetard = enRetard
    .map((c) => {
      const courrier = courriers.find((co) => co.circuitInstanceId === c.id);
      const etape = c.etapes[c.indexCourant];
      return courrier && etape?.echeance ? { courrier, joursRetard: Math.ceil((maintenant().getTime() - new Date(etape.echeance).getTime()) / 86_400_000), poste: postesMap.get(etape.posteAssigneId ?? '') } : undefined;
    })
    .filter((x): x is { courrier: Courrier; joursRetard: number; poste: string | undefined } => !!x)
    .sort((a, b) => b.joursRetard - a.joursRetard)
    .slice(0, 10);

  if (!acteur) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tableau de bord de pilotage</h2>
        <div className="flex shrink-0 gap-1">
          {[7, 30, 90].map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setPeriodeJours(j)}
              className={`rounded px-3 py-1 text-sm whitespace-nowrap ${
                periodeJours === j
                  ? 'bg-[var(--couleur-primaire)] text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {j} j
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Indicateur label="Reçus" valeur={entrants.length} />
        <Indicateur label="Envoyés" valeur={sortants.length} />
        <Indicateur label="En cours" valeur={circuitsEnCours.length} />
        <Indicateur label="En retard" valeur={enRetard.length} alerte={enRetard.length > 0} />
        <Indicateur label="Dans les délais" valeur={`${tauxDansLesDelais}%`} />
        <Indicateur label="Délai signature" valeur={delaiMoyenSignature !== undefined ? `${delaiMoyenSignature} h` : '—'} />
      </div>

      {delaiMoyenTraitement !== undefined && (
        <p className="text-sm text-slate-500">Délai moyen de traitement (réception → clôture) : {delaiMoyenTraitement} j</p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Retards par poste détenteur</h3>
          {donneesRetards.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun retard sur la période.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={donneesRetards} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="nom" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="valeur" fill={PALETTE[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Répartition par type de courrier</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={donneesTypes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="valeur" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Les 10 dossiers les plus en retard</h3>
        {dixPlusEnRetard.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun dossier en retard.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {dixPlusEnRetard.map(({ courrier, joursRetard, poste }) => (
              <li key={courrier.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/courriers/${courrier.id}`)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>{courrier.numero ?? courrier.codeSuivi} — {courrier.objet}</span>
                  <span className="text-xs text-red-500">{joursRetard} j · {poste}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Indicateur({ label, valeur, alerte }: { label: string; valeur: number | string; alerte?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center dark:border-slate-700">
      <p className={`text-2xl font-semibold ${alerte ? 'text-red-500' : 'text-slate-800 dark:text-slate-100'}`}>{valeur}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

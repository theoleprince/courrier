import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Send } from 'lucide-react';
import { db } from '@/db/db';
import type { ActeurCourant } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { maintenant } from '@/services/horloge';
import { objetAffiche } from '@/services/requetes';
import { transmettreParapheur } from '@/services/workflow';
import { genererBordereauPdf, type LigneRegistre } from '@/services/documents';
import { ouvrirPdf } from '@/services/impression';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { BadgePriorite } from '@/components/courrier/Badges';
import type { CourrierEntrant } from '@/types/models';

/**
 * Parapheur en constitution : le bureau d'ordre enregistre les courriers au fil
 * de l'arrivée, ils s'accumulent ici, puis il transmet le lot en une fois
 * (avec, s'il le souhaite, le bordereau de transmission à faire émarger).
 */
export function ParapheurATransmettre({ courriers, acteur }: { courriers: CourrierEntrant[]; acteur: ActeurCourant }): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const navigate = useNavigate();
  const parametres = useParametres();
  // Tout est coché par défaut : le cas courant est de transmettre tout le parapheur.
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [avecBordereau, setAvecBordereau] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const selection = courriers.filter((c) => !exclus.has(c.id));

  function basculer(id: string) {
    setExclus((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  function basculerTout() {
    setExclus(selection.length === courriers.length ? new Set(courriers.map((c) => c.id)) : new Set());
  }

  /** Bordereau adressé aux postes qui reçoivent le lot (première étape de chaque circuit). */
  async function imprimerBordereau(lot: CourrierEntrant[]) {
    if (!parametres) return;
    const circuits = await db.circuits.bulkGet(lot.map((c) => c.circuitInstanceId).filter((id): id is string => !!id));
    const postes = await db.postes.bulkGet([...new Set(circuits.map((c) => c?.posteCourantId).filter((id): id is string => !!id))]);
    const lignes: LigneRegistre[] = [];
    for (const courrier of lot) {
      lignes.push({
        courrier,
        correspondant: await db.correspondants.get(courrier.correspondantId),
        nombrePieces: await db.piecesJointes.where('courrierId').equals(courrier.id).count(),
      });
    }
    const blob = await genererBordereauPdf({
      parametres,
      entiteDestinataire: postes.map((p) => p?.libelle).filter(Boolean).join(', '),
      dateAffichee: maintenant().toLocaleDateString('fr-FR'),
      lignes,
    });
    ouvrirPdf(blob);
  }

  async function surTransmettre() {
    if (selection.length === 0) return;
    setEnCours(true);
    try {
      const lot = await transmettreParapheur(
        selection.map((c) => c.id),
        { personneId: acteur.personne.id, posteId: acteur.poste.id },
      );
      toastSucces(t('parapheur.transmis', { count: lot.length }));
      if (avecBordereau) await imprimerBordereau(lot);
      setExclus(new Set());
    } catch (erreur) {
      toastErreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('parapheur.aTransmettre')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('parapheur.aTransmettreAide')}</p>
        </div>
        <Button variante="secondaire" onClick={() => navigate('/courriers/entrants/nouveau')}>
          {t('parapheur.ajouterCourrier')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400 dark:bg-slate-800">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={t('parapheur.toutSelectionner') ?? undefined}
                  checked={selection.length === courriers.length}
                  onChange={basculerTout}
                />
              </th>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">{t('parapheur.objet')}</th>
              <th className="px-3 py-2">{t('corbeille.priorite')}</th>
              <th className="px-3 py-2">{t('corbeille.recuLe')}</th>
            </tr>
          </thead>
          <tbody>
            {courriers.map((courrier) => (
              <tr key={courrier.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={!exclus.has(courrier.id)} onChange={() => basculer(courrier.id)} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/courriers/${courrier.id}`)}
                    className="font-medium text-[var(--couleur-primaire)] hover:underline"
                  >
                    {courrier.numero ?? courrier.codeSuivi}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{objetAffiche(courrier, 'COMPLET')}</td>
                <td className="px-3 py-2">
                  <BadgePriorite priorite={courrier.priorite} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{format(new Date(courrier.creeLe), 'Pp', { locale })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Button variante="primaire" disabled={selection.length === 0 || enCours} onClick={surTransmettre}>
          <Send size={16} /> {t('parapheur.transmettre', { count: selection.length })}
        </Button>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={avecBordereau} onChange={(e) => setAvecBordereau(e.target.checked)} />
          {t('parapheur.imprimerBordereau')}
        </label>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ShieldCheck } from 'lucide-react';
import { useCourrier } from '@/hooks/useCourrier';
import { useVisibilite } from '@/hooks/useVisibilite';
import { useActeur } from '@/hooks/useActeur';
import { statutClair, construireParcours } from '@/services/suivi';
import { objetAffiche } from '@/services/requetes';
import { verifierPdfDepose } from '@/services/signature';
import { toastSucces, toastErreur } from '@/store/toasts';
import { BadgeStatut, BadgePriorite } from '@/components/courrier/Badges';
import { TimelineParcours } from '@/components/courrier/TimelineParcours';
import { ApercuDocument } from '@/components/courrier/ApercuDocument';
import { PanneauActions } from '@/components/courrier/PanneauActions';
import { VerdictFinal } from '@/components/courrier/VerdictFinal';
import { Tabs, type Onglet } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';

type IdOnglet = 'parcours' | 'historique' | 'signatures' | 'pieces';

export function Detail(): React.JSX.Element {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const acteur = useActeur();
  const donnees = useCourrier(id);
  const niveau = useVisibilite(donnees?.courrier);
  const [onglet, setOnglet] = useState<IdOnglet>('parcours');
  const [pieceSelectionneeId, setPieceSelectionneeId] = useState<string>();

  const statut = useLiveQuery(async () => (donnees?.courrier ? statutClair(donnees.courrier) : undefined), [donnees?.courrier]);
  const parcours = useLiveQuery(
    async () => (donnees?.circuit ? construireParcours(donnees.circuit, niveau !== 'MINIMAL') : []),
    [donnees?.circuit, niveau],
  );

  const onglets: Onglet<IdOnglet>[] = [
    { id: 'parcours', libelle: t('courrier.onglets.parcours') },
    { id: 'historique', libelle: t('courrier.onglets.historique') },
    { id: 'signatures', libelle: t('courrier.onglets.signatures') },
    { id: 'pieces', libelle: t('courrier.onglets.pieces') },
  ];

  const pieceActive = useMemo(() => {
    if (!donnees) return undefined;
    if (pieceSelectionneeId) return donnees.pieces.find((p) => p.id === pieceSelectionneeId);
    const tri = [...donnees.pieces].sort((a, b) => b.version - a.version);
    return tri.find((p) => p.nature === 'VERSION_SIGNEE') ?? tri.find((p) => p.nature === 'BROUILLON') ?? tri[0];
  }, [donnees, pieceSelectionneeId]);

  async function verifierSignature(signatureId: string, empreinteAttendue: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const fichier = input.files?.[0];
      if (!fichier) return;
      const ok = await verifierPdfDepose(fichier, empreinteAttendue);
      if (ok) toastSucces(t('verification.authentique'));
      else toastErreur(t('verification.modifie'));
    };
    input.click();
    void signatureId;
  }

  if (donnees === undefined || acteur === undefined) return <p>{t('commun.chargement')}</p>;
  if (!donnees || !acteur || niveau === 'AUCUN' || niveau === undefined) {
    return <p className="text-slate-500">{t('suivi.codeIntrouvable')}</p>;
  }

  const { courrier, correspondant, pieces, signatures, historique } = donnees;
  const objet = objetAffiche(courrier, niveau);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {courrier.numero ?? courrier.codeSuivi}
            {' · '}
            {courrier.codeSuivi}
          </p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{objet}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{niveau === 'MINIMAL' ? '—' : correspondant?.nom}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statut && <BadgeStatut statut={statut} />}
          <BadgePriorite priorite={courrier.priorite} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {pieces.length > 1 && (
            <select
              className="champ mb-2"
              value={pieceActive?.id ?? ''}
              onChange={(e) => setPieceSelectionneeId(e.target.value)}
            >
              {[...pieces]
                .sort((a, b) => b.version - a.version)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} (v{p.version}, {p.nature})
                  </option>
                ))}
            </select>
          )}
          <ApercuDocument blob={pieceActive?.contenu} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <VerdictFinal
            courrier={courrier}
            circuit={donnees.circuit}
            historique={historique}
            avecPersonnes={niveau !== 'MINIMAL'}
          />
          {niveau === 'COMPLET' && <PanneauActions courrier={courrier} circuit={donnees.circuit} acteur={acteur} />}

          <div>
            <Tabs onglets={onglets} actif={onglet} onChange={setOnglet} />
            <div className="pt-4">
              {onglet === 'parcours' && (parcours ? <TimelineParcours etapes={parcours} /> : null)}

              {onglet === 'historique' && (
                <ul className="space-y-2 text-sm">
                  {historique.map((h) => (
                    <li key={h.id} className="border-b border-slate-100 pb-2 dark:border-slate-800">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{h.action}</span>
                      <span className="ml-2 text-xs text-slate-400">{format(new Date(h.date), 'Pp', { locale })}</span>
                      {h.commentaire && <p className="text-slate-500 dark:text-slate-400">{h.commentaire}</p>}
                    </li>
                  ))}
                  {historique.length === 0 && <p className="text-slate-400">{t('commun.aucunResultat')}</p>}
                </ul>
              )}

              {onglet === 'signatures' && (
                <ul className="space-y-2 text-sm">
                  {signatures.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded border border-slate-200 p-3 dark:border-slate-700">
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {format(new Date(s.date), 'Pp', { locale })}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {t(s.mode === 'MANUSCRITE' ? 'signature.modeManuscrite' : 'signature.modeElectronique')}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400">{t('verification.empreinte')} · {s.empreintePdfSigne?.slice(0, 24)}…</p>
                      </div>
                      <Button variante="secondaire" onClick={() => verifierSignature(s.id, s.empreintePdfSigne ?? '')}>
                        <ShieldCheck size={14} /> {t('verification.verifierIntegrite')}
                      </Button>
                    </li>
                  ))}
                  {signatures.length === 0 && <p className="text-slate-400">{t('commun.aucunResultat')}</p>}
                </ul>
              )}

              {onglet === 'pieces' && (
                <ul className="space-y-2 text-sm">
                  {pieces.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-3 dark:border-slate-700">
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">{p.nom}</p>
                        <p className="text-xs text-slate-400">
                          {p.nature} · v{p.version} · {format(new Date(p.ajouteeLe), 'Pp', { locale })}
                        </p>
                      </div>
                      <Button variante="discret" onClick={() => setPieceSelectionneeId(p.id)}>
                        {t('suivi.voirDetailComplet')}
                      </Button>
                    </li>
                  ))}
                  {pieces.length === 0 && <p className="text-slate-400">{t('commun.aucunResultat')}</p>}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

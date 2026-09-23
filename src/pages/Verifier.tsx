import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { CheckCircle2, XCircle } from 'lucide-react';
import { db } from '@/db/db';
import { sha256 } from '@/services/crypto';
import { useParametres } from '@/hooks/useParametres';
import { ZoneDepot } from '@/components/courrier/ZoneDepot';

export function Verifier(): React.JSX.Element {
  const { signatureId } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const parametres = useParametres();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [resultat, setResultat] = useState<'authentique' | 'modifie' | null>(null);

  const signature = useLiveQuery(() => (signatureId ? db.signatures.get(signatureId) : undefined), [signatureId]);
  const signataire = useLiveQuery(() => (signature ? db.personnes.get(signature.signataireId) : undefined), [signature?.signataireId]);
  const poste = useLiveQuery(() => (signature ? db.postes.get(signature.posteId) : undefined), [signature?.posteId]);
  const courrier = useLiveQuery(() => (signature ? db.courriers.get(signature.courrierId) : undefined), [signature?.courrierId]);

  async function verifierFichier(liste: File[]) {
    setFichiers(liste);
    const fichier = liste[0];
    if (!fichier) {
      setResultat(null);
      return;
    }
    const empreinte = await sha256(fichier);

    if (signature) {
      setResultat(empreinte === signature.empreintePdfSigne ? 'authentique' : 'modifie');
      return;
    }
    const correspondance = await db.signatures.toArray();
    setResultat(correspondance.some((s) => s.empreintePdfSigne === empreinte) ? 'authentique' : 'modifie');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          {parametres?.logoPng && <img src={parametres.logoPng} alt="" className="h-10 w-10 rounded" />}
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('verification.titre')}</h1>
        </div>

        {signature && signataire && poste && (
          <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <p>
              {t('verification.signePar')} <strong>{signataire.prenom} {signataire.nom}</strong> ({poste.libelle})
            </p>
            <p className="text-slate-500">{t('verification.leDate', { date: format(new Date(signature.date), 'Pp', { locale }) })}</p>
            {courrier && <p className="text-slate-500">{courrier.numero}</p>}
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">{t('verification.deposerPdf')}</p>
        <ZoneDepot fichiers={fichiers} onChange={verifierFichier} accept="application/pdf" multiple={false} apercu={false} />

        {resultat === 'authentique' && (
          <p className="mt-4 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 size={18} /> {t('verification.authentique')}
          </p>
        )}
        {resultat === 'modifie' && (
          <p className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <XCircle size={18} /> {t('verification.modifie')}
          </p>
        )}
      </div>
    </div>
  );
}

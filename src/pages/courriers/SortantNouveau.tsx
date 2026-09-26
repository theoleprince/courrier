import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { creerSortant } from '@/services/workflow';
import { genererLettrePdf, remplacerVariables } from '@/services/documents';
import { maintenant } from '@/services/horloge';
import { ouvrirPdf } from '@/services/impression';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { ZoneDepot } from '@/components/courrier/ZoneDepot';
import { SelecteurCorrespondant } from '@/components/courrier/SelecteurCorrespondant';
import type { CourrierEntrant, Priorite, TypeCourrier } from '@/types/models';

const typesCourrier: TypeCourrier[] = ['LETTRE', 'FACTURE', 'CONVOCATION', 'NOTE', 'DEMANDE', 'RECLAMATION', 'AUTRE'];
const priorites: Priorite[] = ['NORMALE', 'URGENTE', 'TRES_URGENTE'];

interface FormValues {
  objet: string;
  type: TypeCourrier;
  priorite: Priorite;
  confidentialite: 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL';
  correspondantId: string;
  motsCles: string;
  corpsLettre: string;
  emailDestinataire: string;
}

export function SortantNouveau(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const enReponseA = params.get('enReponseA') ?? undefined;
  const correspondantPrefill = params.get('correspondantId') ?? undefined;
  const acteur = useActeur();
  const parametres = useParametres();
  const [mode, setMode] = useState<'modele' | 'fichier'>('modele');
  const [modeleId, setModeleId] = useState<string>();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);

  const entrantLie = useLiveQuery(
    () => (enReponseA ? (db.courriers.get(enReponseA) as Promise<CourrierEntrant | undefined>) : undefined),
    [enReponseA],
  );
  const modelesLettre = useLiveQuery(() => db.modelesLettre.toArray()) ?? [];
  const correspondantEntrant = useLiveQuery(
    () => (entrantLie ? db.correspondants.get(entrantLie.correspondantId) : undefined),
    [entrantLie?.correspondantId],
  );

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', motsCles: '', corpsLettre: '', emailDestinataire: '' },
  });

  const correspondantId = watch('correspondantId');
  const corpsLettre = watch('corpsLettre');
  // Adresse proposée : celle donnée pour la réponse sur l'entrant, sinon celle du correspondant.
  const emailPropose = useLiveQuery(async () => {
    if (entrantLie?.emailReponse) return entrantLie.emailReponse;
    const id = entrantLie?.correspondantId ?? correspondantId;
    return id ? (await db.correspondants.get(id))?.email ?? '' : '';
  }, [entrantLie?.emailReponse, entrantLie?.correspondantId, correspondantId]);
  useEffect(() => {
    if (emailPropose !== undefined) setValue('emailDestinataire', emailPropose);
  }, [emailPropose, setValue]);

  useEffect(() => {
    if (entrantLie) {
      setValue('correspondantId', entrantLie.correspondantId);
      setValue('objet', `Re: ${entrantLie.objet}`);
    } else if (correspondantPrefill) {
      setValue('correspondantId', correspondantPrefill);
    }
  }, [entrantLie, correspondantPrefill, setValue]);

  function appliquerModele(id: string) {
    setModeleId(id);
    const modele = modelesLettre.find((m) => m.id === id);
    if (!modele) return;
    const variables = {
      'correspondant.nom': correspondantEntrant?.nom ?? '',
      'entrant.numero': entrantLie?.numero ?? '',
      'entrant.referenceExpediteur': entrantLie?.referenceExpediteur ?? '',
      'entrant.dateCourrier': entrantLie?.dateCourrier ?? '',
      'entrant.objet': entrantLie?.objet ?? '',
      'organisation.nom': parametres?.nomOrganisation ?? '',
      date: maintenant().toLocaleDateString('fr-FR'),
    };
    setValue('objet', remplacerVariables(modele.objet, variables));
    setValue('corpsLettre', remplacerVariables(modele.corps, variables));
  }

  async function construireDocument(objet: string, corps: string): Promise<{ blob: Blob; nom: string; mime: string }> {
    if (mode === 'fichier' && fichiers[0]) {
      return { blob: fichiers[0], nom: fichiers[0].name, mime: fichiers[0].type || 'application/pdf' };
    }
    if (!parametres) throw new Error('parametres');
    const correspondant = correspondantEntrant ?? (correspondantId ? await db.correspondants.get(correspondantId) : undefined);
    const blob = await genererLettrePdf({
      parametres,
      objet,
      corps,
      correspondant: correspondant ?? { id: '', nom: '', categorie: 'PARTICULIER' },
      referenceCourrier: entrantLie?.numero ?? undefined,
      dateAffichee: maintenant().toLocaleDateString('fr-FR'),
    });
    return { blob, nom: 'lettre.pdf', mime: 'application/pdf' };
  }

  async function apercuPdf(objet: string, corps: string) {
    const document_ = await construireDocument(objet, corps);
    ouvrirPdf(document_.blob);
  }

  async function soumettre(valeurs: FormValues, soumettreCircuit: boolean) {
    if (!acteur) return;
    setEnCours(true);
    try {
      const document_ = await construireDocument(valeurs.objet, valeurs.corpsLettre);
      const courrier = await creerSortant(
        {
          objet: valeurs.objet,
          type: valeurs.type,
          priorite: valeurs.priorite,
          confidentialite: valeurs.confidentialite,
          correspondantId: valeurs.correspondantId,
          reponseAId: enReponseA,
          modeleLettreId: mode === 'modele' ? modeleId : undefined,
          motsCles: valeurs.motsCles.split(',').map((m) => m.trim()).filter(Boolean),
          emailDestinataire: valeurs.emailDestinataire.trim() || undefined,
        },
        document_,
        { personneId: acteur.personne.id, posteId: acteur.poste.id },
        soumettreCircuit,
      );
      toastSucces(soumettreCircuit ? t('courrier.soumettreAuCircuit') : t('courrier.enregistrerBrouillon'));
      navigate(`/courriers/${courrier.id}`);
    } catch (erreur) {
      toastErreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('courrier.nouveauSortant')}</h1>
      {entrantLie && (
        <p className="mb-4 text-sm text-slate-500">
          {t('courrier.enReponseA')} : {entrantLie.numero} — {entrantLie.objet}
        </p>
      )}

      <div className="mb-4 flex gap-2">
        <Button variante={mode === 'modele' ? 'primaire' : 'secondaire'} onClick={() => setMode('modele')}>
          {t('courrier.choisirModele')}
        </Button>
        <Button variante={mode === 'fichier' ? 'primaire' : 'secondaire'} onClick={() => setMode('fichier')}>
          {t('courrier.deposerDocument')}
        </Button>
      </div>

      <form onSubmit={handleSubmit((v) => soumettre(v, true))} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {!entrantLie && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.correspondant')}</span>
            <SelecteurCorrespondant valeur={correspondantId} onChange={(id) => setValue('correspondantId', id, { shouldValidate: true })} />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.type')}</span>
          <select className="champ" {...register('type')}>
            {typesCourrier.map((v) => (
              <option key={v} value={v}>{t(`typeCourrier.${v}`)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.priorite')}</span>
          <select className="champ" {...register('priorite')}>
            {priorites.map((v) => (
              <option key={v} value={v}>{t(`priorite.${v}`)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.confidentialite')}</span>
          <select className="champ" {...register('confidentialite')}>
            {(['PUBLIC', 'INTERNE', 'CONFIDENTIEL'] as const).map((v) => (
              <option key={v} value={v}>{t(`confidentialite.${v}`)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.emailDestinataire')}</span>
          <input
            type="email"
            className="champ"
            placeholder="nom@exemple.com"
            {...register('emailDestinataire', { pattern: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/ })}
          />
          {errors.emailDestinataire ? (
            <p className="mt-1 text-xs text-red-500">{t('erreurs.emailInvalide')}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">{t('courrier.emailDestinataireAide')}</p>
          )}
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.objet')}</span>
          <input className="champ" {...register('objet', { required: true })} />
          {errors.objet && <p className="mt-1 text-xs text-red-500">{t('erreurs.imputationManquante')}</p>}
        </label>

        {mode === 'modele' ? (
          <div className="space-y-3 md:col-span-2">
            <select className="champ" value={modeleId ?? ''} onChange={(e) => appliquerModele(e.target.value)}>
              <option value="" disabled>{t('courrier.choisirModele')}</option>
              {modelesLettre.map((m) => (
                <option key={m.id} value={m.id}>{m.libelle} ({m.langue})</option>
              ))}
            </select>
            <textarea className="champ font-mono text-xs" rows={10} {...register('corpsLettre')} />
            <Button type="button" variante="discret" onClick={() => apercuPdf(watch('objet'), corpsLettre)}>
              {t('courrier.apercuLettre')}
            </Button>
          </div>
        ) : (
          <div className="md:col-span-2">
            <ZoneDepot fichiers={fichiers} onChange={setFichiers} multiple={false} />
          </div>
        )}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.motsCles')}</span>
          <input className="champ" {...register('motsCles')} />
        </label>

        <div className="flex gap-2 md:col-span-2">
          <Button type="button" variante="secondaire" disabled={enCours} onClick={handleSubmit((v) => soumettre(v, false))}>
            {t('courrier.enregistrerBrouillon')}
          </Button>
          <Button type="submit" variante="primaire" disabled={enCours}>
            {t('courrier.soumettreAuCircuit')}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { enregistrerEntrant } from '@/services/workflow';
import { assemblerFichiersEnPdf, genererRecepisse } from '@/services/documents';
import { maintenant } from '@/services/horloge';
import { ouvrirPdf } from '@/services/impression';
import { messageErreur } from '@/services/traduireErreur';
import { toastErreur, toastSucces } from '@/store/toasts';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ZoneDepot } from '@/components/courrier/ZoneDepot';
import { SelecteurCorrespondant } from '@/components/courrier/SelecteurCorrespondant';
import type { CourrierEntrant, ModeDepot, Priorite, TypeCourrier } from '@/types/models';
import { origineApp } from '@/services/urls';

const schema = z.object({
  objet: z.string().min(1),
  type: z.custom<TypeCourrier>(),
  priorite: z.custom<Priorite>(),
  confidentialite: z.enum(['PUBLIC', 'INTERNE', 'CONFIDENTIEL']),
  correspondantId: z.string().min(1),
  modeDepot: z.custom<ModeDepot>(),
  deposantNom: z.string().optional(),
  deposantTelephone: z.string().optional(),
  dateCourrier: z.string().optional(),
  referenceExpediteur: z.string().optional(),
  reponseAttendue: z.boolean(),
  dateLimiteReponse: z.string().optional(),
  emailReponse: z.union([z.literal(''), z.string().trim().email()]).optional(),
  motsCles: z.string().optional(),
});
type Formulaire = z.infer<typeof schema>;

const typesCourrier: TypeCourrier[] = ['LETTRE', 'FACTURE', 'CONVOCATION', 'NOTE', 'DEMANDE', 'RECLAMATION', 'AUTRE'];
const priorites: Priorite[] = ['NORMALE', 'URGENTE', 'TRES_URGENTE'];
const modesDepot: ModeDepot[] = ['GUICHET', 'POSTE', 'COURSIER', 'EMAIL'];

export function EntrantNouveau(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const parametres = useParametres();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<CourrierEntrant | null>(null);
  const correspondants = useLiveQuery(() => db.correspondants.toArray()) ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Formulaire>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'LETTRE',
      priorite: 'NORMALE',
      confidentialite: 'INTERNE',
      modeDepot: 'GUICHET',
      reponseAttendue: false,
    },
  });

  const modeDepot = watch('modeDepot');
  const reponseAttendue = watch('reponseAttendue');
  const correspondantId = watch('correspondantId');
  const emailCorrespondant = useLiveQuery(
    async () => (correspondantId ? (await db.correspondants.get(correspondantId))?.email ?? '' : ''),
    [correspondantId],
  );
  // Préremplit l'adresse de réponse avec celle du correspondant choisi.
  useEffect(() => {
    if (emailCorrespondant !== undefined) setValue('emailReponse', emailCorrespondant);
  }, [emailCorrespondant, setValue]);

  async function surSoumission(valeurs: Formulaire) {
    if (!acteur) return;
    setEnCours(true);
    try {
      const fichier =
        fichiers.length > 0
          ? { blob: await assemblerFichiersEnPdf(fichiers), nom: 'scan.pdf', mime: 'application/pdf' }
          : undefined;

      const courrier = await enregistrerEntrant(
        {
          objet: valeurs.objet,
          type: valeurs.type,
          priorite: valeurs.priorite,
          confidentialite: valeurs.confidentialite,
          correspondantId: valeurs.correspondantId,
          modeDepot: valeurs.modeDepot,
          deposant: valeurs.deposantNom ? { nom: valeurs.deposantNom, telephone: valeurs.deposantTelephone } : undefined,
          dateCourrier: valeurs.dateCourrier,
          referenceExpediteur: valeurs.referenceExpediteur,
          reponseAttendue: valeurs.reponseAttendue,
          dateLimiteReponse: valeurs.dateLimiteReponse,
          emailReponse: valeurs.reponseAttendue ? valeurs.emailReponse : undefined,
          motsCles: valeurs.motsCles?.split(',').map((m) => m.trim()).filter(Boolean),
        },
        fichier,
        { personneId: acteur.personne.id, posteId: acteur.poste.id },
      );
      setResultat(courrier);
      toastSucces(t('courrier.courrierEnregistre', { numero: courrier.numero }));
    } catch (erreur) {
      toastErreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  async function imprimerRecepisse() {
    if (!resultat || !parametres) return;
    const correspondant = correspondants.find((c) => c.id === resultat.correspondantId);
    if (!correspondant) return;
    const blob = await genererRecepisse({
      courrier: resultat,
      correspondant,
      parametres,
      nombrePages: fichiers.length || 1,
      urlPortail: `${origineApp()}/portail?code=${resultat.codeSuivi}`,
      dateAffichee: maintenant().toLocaleString('fr-FR'),
    });
    ouvrirPdf(blob);
  }

  function nouveauFormulaire() {
    setResultat(null);
    setFichiers([]);
    reset();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('courrier.nouveauEntrant')}</h1>

      <form onSubmit={handleSubmit(surSoumission)} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4 md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.fichier')}</span>
          <ZoneDepot fichiers={fichiers} onChange={setFichiers} />
        </div>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.objet')}</span>
          <input className="champ" {...register('objet')} />
          {errors.objet && <p className="mt-1 text-xs text-red-500">{errors.objet.message}</p>}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.correspondant')}</span>
          <SelecteurCorrespondant valeur={correspondantId} onChange={(id) => setValue('correspondantId', id, { shouldValidate: true })} />
          {errors.correspondantId && <p className="mt-1 text-xs text-red-500">{t('erreurs.imputationManquante')}</p>}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.type')}</span>
          <select className="champ" {...register('type')}>
            {typesCourrier.map((v) => (
              <option key={v} value={v}>
                {t(`typeCourrier.${v}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.priorite')}</span>
          <select className="champ" {...register('priorite')}>
            {priorites.map((v) => (
              <option key={v} value={v}>
                {t(`priorite.${v}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.confidentialite')}</span>
          <select className="champ" {...register('confidentialite')}>
            {(['PUBLIC', 'INTERNE', 'CONFIDENTIEL'] as const).map((v) => (
              <option key={v} value={v}>
                {t(`confidentialite.${v}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.modeDepot')}</span>
          <select className="champ" {...register('modeDepot')}>
            {modesDepot.map((v) => (
              <option key={v} value={v}>
                {t(`modeDepot.${v}`)}
              </option>
            ))}
          </select>
        </label>

        {modeDepot === 'GUICHET' && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.deposant')}</span>
              <input className="champ" {...register('deposantNom')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {t('admin.personnalisation.telephone')}
              </span>
              <input className="champ" placeholder="+237…" {...register('deposantTelephone')} />
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.dateCourrier')}</span>
          <input type="date" className="champ" {...register('dateCourrier')} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.referenceExpediteur')}</span>
          <input className="champ" {...register('referenceExpediteur')} />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" {...register('reponseAttendue')} />
          {t('courrier.reponseAttendue')}
        </label>

        {reponseAttendue && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.dateLimiteReponse')}</span>
            <input type="date" className="champ" {...register('dateLimiteReponse')} />
          </label>
        )}

        {reponseAttendue && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.emailReponse')}</span>
            <input type="email" className="champ" placeholder="nom@exemple.com" {...register('emailReponse')} />
            {errors.emailReponse ? (
              <p className="mt-1 text-xs text-red-500">{t('erreurs.emailInvalide')}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{t('courrier.emailReponseAide')}</p>
            )}
          </label>
        )}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('courrier.motsCles')}</span>
          <input className="champ" placeholder="facture, urgent, …" {...register('motsCles')} />
        </label>

        <div className="md:col-span-2">
          <Button type="submit" variante="primaire" disabled={enCours}>
            {t('courrier.enregistrer')}
          </Button>
        </div>
      </form>

      {resultat && (
        <Modal titre={t('courrier.courrierEnregistre', { numero: resultat.numero })} onFermer={() => navigate(`/courriers/${resultat.id}`)}>
          <div className="space-y-4">
            <div className="rounded-md bg-slate-50 p-4 text-center dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t('portail.codeSuivi')}</p>
              <p className="my-2 text-2xl font-bold tracking-widest text-[var(--couleur-primaire)]">{resultat.codeSuivi}</p>
              <p className="text-sm text-slate-500">{resultat.numero}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variante="primaire" onClick={imprimerRecepisse}>
                {t('courrier.enregistrerEtImprimer')}
              </Button>
              <Button variante="secondaire" onClick={nouveauFormulaire}>
                {t('courrier.enregistrerUnAutre')}
              </Button>
              <Button variante="discret" onClick={() => navigate(`/courriers/${resultat.id}`)}>
                {t('suivi.voirDetailComplet')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

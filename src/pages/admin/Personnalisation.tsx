import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useParametres } from '@/hooks/useParametres';
import { mettreAJourParametres, lireFichierEnDataUrl } from '@/services/parametres';
import { Button } from '@/components/ui/Button';
import { Tabs, type Onglet } from '@/components/ui/Tabs';

type IdOnglet = 'identite' | 'apparence' | 'fonctionnement';

const onglets: Onglet<IdOnglet>[] = [
  { id: 'identite', libelle: 'Identité' },
  { id: 'apparence', libelle: 'Apparence et langue' },
  { id: 'fonctionnement', libelle: 'Fonctionnement' },
];

const schema = z.object({
  nomOrganisation: z.string().min(1),
  sigle: z.string().min(1).max(10),
  adresse: z.string().min(1),
  telephone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  couleurPrimaire: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  langue: z.enum(['fr', 'en']),
  delaiEscaladeJours: z.coerce.number().int().min(1).max(30),
  modeDemo: z.boolean(),
});

type Formulaire = z.infer<typeof schema>;

export function Personnalisation(): React.JSX.Element {
  const { t } = useTranslation();
  const parametres = useParametres();
  const [onglet, setOnglet] = useState<IdOnglet>('identite');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitSuccessful },
  } = useForm<Formulaire>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!parametres) return;
    reset({
      nomOrganisation: parametres.nomOrganisation,
      sigle: parametres.sigle,
      adresse: parametres.adresse,
      telephone: parametres.telephone ?? '',
      email: parametres.email ?? '',
      couleurPrimaire: parametres.couleurPrimaire,
      langue: parametres.langue,
      delaiEscaladeJours: parametres.delaiEscaladeJours,
      modeDemo: parametres.modeDemo,
    });
  }, [parametres, reset]);

  const couleur = watch('couleurPrimaire');

  useEffect(() => {
    if (couleur) document.documentElement.style.setProperty('--couleur-primaire', couleur);
  }, [couleur]);

  async function surSoumission(valeurs: Formulaire) {
    await mettreAJourParametres(valeurs);
  }

  async function surChangementLogo(fichier: File | undefined) {
    if (!fichier) return;
    const dataUrl = await lireFichierEnDataUrl(fichier);
    await mettreAJourParametres({ logoPng: dataUrl });
  }

  if (!parametres) return <p>{t('commun.chargement')}</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">
        {t('admin.personnalisation.titre')}
      </h1>

      <Tabs onglets={onglets} actif={onglet} onChange={setOnglet} />

      {/* Un seul formulaire : les onglets masquent les champs sans les démonter, tout est enregistré ensemble. */}
      <form onSubmit={handleSubmit(surSoumission)} className="mt-4 space-y-4">
        <div hidden={onglet !== 'identite'} className="space-y-4">
          <Champ label={t('admin.personnalisation.nomOrganisation')}>
            <input className="champ" {...register('nomOrganisation')} />
          </Champ>

          <Champ label={t('admin.personnalisation.sigle')}>
            <input className="champ" {...register('sigle')} />
          </Champ>

          <Champ label={t('admin.personnalisation.adresse')}>
            <input className="champ" {...register('adresse')} />
          </Champ>

          <div className="grid grid-cols-2 gap-4">
            <Champ label={t('admin.personnalisation.telephone')}>
              <input className="champ" {...register('telephone')} />
            </Champ>
            <Champ label={t('admin.personnalisation.email')}>
              <input className="champ" type="email" {...register('email')} />
            </Champ>
          </div>
        </div>

        <div hidden={onglet !== 'apparence'} className="space-y-4">
          <Champ label={t('admin.personnalisation.logo')}>
            <div className="flex items-center gap-3">
              {parametres.logoPng && (
                <img src={parametres.logoPng} alt="" className="h-12 w-12 rounded" />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => void surChangementLogo(e.target.files?.[0])}
                className="text-sm"
              />
            </div>
          </Champ>

          <Champ label={t('admin.personnalisation.couleurPrimaire')}>
            <input type="color" className="h-10 w-20" {...register('couleurPrimaire')} />
          </Champ>

          <Champ label={t('admin.personnalisation.langueParDefaut')}>
            <select className="champ" {...register('langue')}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </Champ>
        </div>

        <div hidden={onglet !== 'fonctionnement'} className="space-y-4">
          <Champ label={t('admin.personnalisation.delaiEscalade')}>
            <input
              type="number"
              min={1}
              max={30}
              className="champ"
              {...register('delaiEscaladeJours')}
            />
          </Champ>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              {...register('modeDemo')}
              onChange={(e) => setValue('modeDemo', e.target.checked)}
            />
            {t('admin.personnalisation.modeDemo')}
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variante="primaire">
            {t('commun.enregistrer')}
          </Button>
          {isSubmitSuccessful && (
            <span className="text-sm text-green-600">{t('admin.personnalisation.enregistre')}</span>
          )}
        </div>
      </form>
    </div>
  );
}

function Champ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

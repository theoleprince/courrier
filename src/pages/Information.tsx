import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useActeur } from '@/hooks/useActeur';
import { pourInformation, objetAffiche } from '@/services/requetes';
import { marquerLu } from '@/services/workflow';
import { Button } from '@/components/ui/Button';

export function Information(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;
  const navigate = useNavigate();
  const acteur = useActeur();
  const elements = useLiveQuery(() => (acteur ? pourInformation(acteur.poste.id) : []), [acteur?.poste.id]) ?? [];

  async function surMarquerLu(id: string) {
    if (!acteur) return;
    await marquerLu(id, { personneId: acteur.personne.id, posteId: acteur.poste.id });
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('information.titre')}</h1>
      {elements.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('information.vide')}</p>
      ) : (
        <ul className="space-y-2">
          {elements.map(({ diffusion, courrier }) => (
            <li
              key={diffusion.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <button type="button" onClick={() => navigate(`/courriers/${courrier.id}`)} className="text-left">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {courrier.numero ?? courrier.codeSuivi} — {objetAffiche(courrier, 'COMPLET')}
                </p>
                <p className="text-xs text-slate-400">
                  {t('information.diffuseLe', { date: format(new Date(diffusion.diffuseeLe), 'Pp', { locale }) })}
                </p>
              </button>
              {!diffusion.lueLe && (
                <Button variante="secondaire" onClick={() => surMarquerLu(diffusion.id)}>
                  {t('information.marquerLu')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

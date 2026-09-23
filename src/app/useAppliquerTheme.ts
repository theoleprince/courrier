import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParametres } from '@/hooks/useParametres';
import { useSessionStore } from '@/store/session';

/** Applique la couleur primaire du client en variable CSS et synchronise la langue active. */
export function useAppliquerTheme(): void {
  const parametres = useParametres();
  const langueSession = useSessionStore((s) => s.langue);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (parametres?.couleurPrimaire) {
      document.documentElement.style.setProperty('--couleur-primaire', parametres.couleurPrimaire);
    }
  }, [parametres?.couleurPrimaire]);

  useEffect(() => {
    if (i18n.language !== langueSession) {
      void i18n.changeLanguage(langueSession);
    }
    document.documentElement.lang = langueSession;
  }, [langueSession, i18n]);
}

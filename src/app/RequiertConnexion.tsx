import { useEffect, type PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/session';
import { useActeur } from '@/hooks/useActeur';

export function RequiertConnexion({ children }: PropsWithChildren): React.JSX.Element {
  const acteurStocke = useSessionStore((s) => s.acteur);
  const deconnecter = useSessionStore((s) => s.deconnecter);
  // null = session enregistrée qui ne correspond plus à personne (ex. après réinitialisation de la démo).
  const acteur = useActeur();
  const sessionInvalide = !!acteurStocke && acteur === null;

  useEffect(() => {
    if (sessionInvalide) deconnecter();
  }, [sessionInvalide, deconnecter]);

  if (!acteurStocke || sessionInvalide) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

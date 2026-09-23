import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/session';

export function RequiertConnexion({ children }: PropsWithChildren): React.JSX.Element {
  const acteur = useSessionStore((s) => s.acteur);
  if (!acteur) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

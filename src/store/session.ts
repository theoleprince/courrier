import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Acteur } from '@/types/models';

interface SessionState {
  acteur: Acteur | null;
  langue: 'fr' | 'en';
  connecter: (acteur: Acteur) => void;
  changerPoste: (posteId: string) => void;
  deconnecter: () => void;
  definirLangue: (langue: 'fr' | 'en') => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      acteur: null,
      langue: 'fr',
      connecter: (acteur) => set({ acteur }),
      changerPoste: (posteId) =>
        set((etat) => (etat.acteur ? { acteur: { ...etat.acteur, posteId } } : etat)),
      deconnecter: () => set({ acteur: null }),
      definirLangue: (langue) => set({ langue }),
    }),
    { name: 'gestion-courrier-session' },
  ),
);

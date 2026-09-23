import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DemoState {
  barreRepliee: boolean;
  basculerBarre: () => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      barreRepliee: false,
      basculerBarre: () => set((etat) => ({ barreRepliee: !etat.barreRepliee })),
    }),
    { name: 'gestion-courrier-demo-ui' },
  ),
);

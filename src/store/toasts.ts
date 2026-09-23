import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'succes' | 'erreur' | 'info';
}

interface ToastsState {
  toasts: Toast[];
  ajouter: (message: string, type?: Toast['type']) => void;
  retirer: (id: string) => void;
}

export const useToastsStore = create<ToastsState>((set) => ({
  toasts: [],
  ajouter: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((etat) => ({ toasts: [...etat.toasts, { id, message, type }] }));
    setTimeout(() => set((etat) => ({ toasts: etat.toasts.filter((t) => t.id !== id) })), 4000);
  },
  retirer: (id) => set((etat) => ({ toasts: etat.toasts.filter((t) => t.id !== id) })),
}));

export function toastSucces(message: string): void {
  useToastsStore.getState().ajouter(message, 'succes');
}
export function toastErreur(message: string): void {
  useToastsStore.getState().ajouter(message, 'erreur');
}

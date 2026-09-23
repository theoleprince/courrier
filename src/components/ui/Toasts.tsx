import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastsStore } from '@/store/toasts';
import { useParametres } from '@/hooks/useParametres';

const stylesParType = {
  succes: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
  erreur: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
};

const iconesParType = { succes: CheckCircle2, erreur: XCircle, info: Info };

export function Toasts(): React.JSX.Element {
  const toasts = useToastsStore((s) => s.toasts);
  const retirer = useToastsStore((s) => s.retirer);
  const parametres = useParametres();
  // La barre de démo occupe le bas de l'écran : les toasts doivent s'afficher
  // au-dessus pour ne pas intercepter ses clics (ex. « Changer d'utilisateur »).
  const decalageBas = parametres?.modeDemo ? 'bottom-20' : 'bottom-4';

  return (
    <div className={`pointer-events-none fixed ${decalageBas} left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4`}>
      {toasts.map((toast) => {
        const Icone = iconesParType[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${stylesParType[toast.type]}`}
          >
            <Icone size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button type="button" onClick={() => retirer(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

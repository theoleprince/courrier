import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

const classesParVariante: Record<Variante, string> = {
  primaire: 'bg-[var(--couleur-primaire)] text-white hover:brightness-110 disabled:opacity-50',
  secondaire:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700',
  discret: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'secondaire', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--couleur-primaire)] disabled:cursor-not-allowed ${classesParVariante[variante]} ${className}`}
      {...props}
    />
  );
});

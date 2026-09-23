import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

const classesParVariante: Record<Variante, string> = {
  primaire:
    'bg-[var(--couleur-primaire)] text-white shadow-sm shadow-[var(--primaire-anneau)] hover:brightness-110 hover:shadow-md disabled:opacity-50 disabled:shadow-none',
  secondaire:
    'bg-[var(--surface)] text-slate-700 border border-[var(--bordure)] shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800',
  discret: 'text-slate-600 hover:bg-[var(--primaire-doux)] hover:text-[var(--couleur-primaire)] dark:text-slate-300',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-50',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'secondaire', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--couleur-primaire)] disabled:cursor-not-allowed ${classesParVariante[variante]} ${className}`}
      {...props}
    />
  );
});

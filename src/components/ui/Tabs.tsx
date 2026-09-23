export interface Onglet<T extends string> {
  id: T;
  libelle: string;
}

interface Props<T extends string> {
  onglets: Onglet<T>[];
  actif: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ onglets, actif, onChange }: Props<T>): React.JSX.Element {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60" role="tablist">
      {onglets.map((onglet) => (
        <button
          key={onglet.id}
          type="button"
          role="tab"
          aria-selected={actif === onglet.id}
          onClick={() => onChange(onglet.id)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
            actif === onglet.id
              ? 'bg-[var(--surface)] text-[var(--couleur-primaire)] shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {onglet.libelle}
        </button>
      ))}
    </div>
  );
}

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
    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist">
      {onglets.map((onglet) => (
        <button
          key={onglet.id}
          type="button"
          role="tab"
          aria-selected={actif === onglet.id}
          onClick={() => onChange(onglet.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            actif === onglet.id
              ? 'border-[var(--couleur-primaire)] text-[var(--couleur-primaire)]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {onglet.libelle}
        </button>
      ))}
    </div>
  );
}

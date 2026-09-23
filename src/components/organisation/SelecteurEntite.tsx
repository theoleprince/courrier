import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Entite, ID } from '@/types/models';

function profondeur(entite: Entite, parId: Map<ID, Entite>): number {
  let n = 0;
  let courante = entite;
  while (courante.parentId) {
    const parent = parId.get(courante.parentId);
    if (!parent) break;
    n += 1;
    courante = parent;
  }
  return n;
}

function trierHierarchie(entites: Entite[]): Entite[] {
  const parId = new Map(entites.map((e) => [e.id, e]));
  const parParent = new Map<ID | null, Entite[]>();
  for (const e of entites) {
    const liste = parParent.get(e.parentId) ?? [];
    liste.push(e);
    parParent.set(e.parentId, liste);
  }
  const resultat: Entite[] = [];
  function visiter(parentId: ID | null) {
    for (const e of parParent.get(parentId) ?? []) {
      resultat.push(e);
      visiter(e.id);
    }
  }
  visiter(null);
  return resultat.map((e) => ({ ...e, _profondeur: profondeur(e, parId) }) as Entite);
}

interface Props {
  valeur: string | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function SelecteurEntite({ valeur, onChange, placeholder }: Props): React.JSX.Element {
  const entites = useLiveQuery(() => db.entites.toArray()) ?? [];
  const parId = new Map(entites.map((e) => [e.id, e]));
  const triees = trierHierarchie(entites.filter((e) => e.actif));

  return (
    <select className="champ" value={valeur ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {placeholder ?? ''}
      </option>
      {triees.map((e) => (
        <option key={e.id} value={e.id}>
          {'  '.repeat(profondeur(e, parId))}
          {e.libelle}
        </option>
      ))}
    </select>
  );
}

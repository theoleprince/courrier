import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

interface Props {
  valeur: string | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function SelecteurPoste({ valeur, onChange, placeholder }: Props): React.JSX.Element {
  const postes = useLiveQuery(() => db.postes.toArray()) ?? [];
  const entites = useLiveQuery(() => db.entites.toArray()) ?? [];
  const entiteParId = new Map(entites.map((e) => [e.id, e]));

  const postesActifs = postes
    .filter((p) => p.actif)
    .slice()
    .sort((a, b) => (entiteParId.get(a.entiteId)?.libelle ?? '').localeCompare(entiteParId.get(b.entiteId)?.libelle ?? ''));

  return (
    <select className="champ" value={valeur ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {placeholder ?? ''}
      </option>
      {postesActifs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.libelle} — {entiteParId.get(p.entiteId)?.libelle ?? ''}
        </option>
      ))}
    </select>
  );
}

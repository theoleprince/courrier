/** Sérialisation JSON déterministe (clés triées récursivement) pour les empreintes. */
export function canonicalJSON(valeur: unknown): string {
  return stringifier(valeur);
}

function stringifier(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return 'null';
  if (typeof valeur !== 'object') return JSON.stringify(valeur);
  if (Array.isArray(valeur)) return `[${valeur.map(stringifier).join(',')}]`;
  const cles = Object.keys(valeur as Record<string, unknown>).sort();
  const paires = cles.map(
    (cle) => `${JSON.stringify(cle)}:${stringifier((valeur as Record<string, unknown>)[cle])}`,
  );
  return `{${paires.join(',')}}`;
}

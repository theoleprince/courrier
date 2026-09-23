/** Ouvre un PDF généré dans un nouvel onglet (l'utilisateur imprime avec Ctrl+P). */
export function ouvrirPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Erreur métier : `message` est une clé i18n directement affichable. */
export class ErreurWorkflow extends Error {
  constructor(
    public readonly cle: string,
    public readonly params?: Record<string, unknown>,
  ) {
    super(cle);
    this.name = 'ErreurWorkflow';
  }
}

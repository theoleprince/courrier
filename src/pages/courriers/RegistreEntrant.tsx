import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Download, FileStack } from 'lucide-react';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { maintenant } from '@/services/horloge';
import { niveauAcces, objetAffiche } from '@/services/requetes';
import { genererBordereauPdf, genererRegistreCsv, genererRegistrePdf, type LigneRegistre } from '@/services/documents';
import { ouvrirPdf } from '@/services/impression';
import { toastErreur } from '@/store/toasts';
import { TableCourriers } from '@/components/courrier/TableCourriers';
import { SelecteurEntite } from '@/components/organisation/SelecteurEntite';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export function RegistreEntrant(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const parametres = useParametres();
  const courriers = useLiveQuery(() => db.courriers.where('sens').equals('ENTRANT').reverse().sortBy('creeLe')) ?? [];
  const correspondants = useLiveQuery(() => db.correspondants.toArray()) ?? [];
  const pieces = useLiveQuery(() => db.piecesJointes.toArray()) ?? [];

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [ouvrirBordereau, setOuvrirBordereau] = useState(false);
  const [entiteDestinataire, setEntiteDestinataire] = useState<string>();

  function basculerSelection(id: string) {
    setSelection((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  async function construireLignes(idsFiltre?: Set<string>): Promise<LigneRegistre[]> {
    if (!acteur) return [];
    const lignes: LigneRegistre[] = [];
    for (const courrier of courriers.filter((c) => !idsFiltre || idsFiltre.has(c.id))) {
      const niveau = await niveauAcces(courrier, acteur);
      if (niveau === 'AUCUN') continue;
      const masque = niveau === 'MINIMAL';
      lignes.push({
        courrier: masque ? { ...courrier, objet: objetAffiche(courrier, niveau) } : courrier,
        correspondant: masque ? undefined : correspondants.find((c) => c.id === courrier.correspondantId),
        nombrePieces: pieces.filter((p) => p.courrierId === courrier.id).length,
      });
    }
    return lignes;
  }

  async function exporterCsv() {
    const lignes = await construireLignes(selection.size > 0 ? selection : undefined);
    const blob = genererRegistreCsv(lignes);
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `registre-entrant-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function exporterRegistrePdf() {
    if (!parametres) return;
    const lignes = await construireLignes(selection.size > 0 ? selection : undefined);
    const blob = await genererRegistrePdf({
      parametres,
      titre: 'Registre chronologique — arrivée',
      periode: `Édité le ${maintenant().toLocaleDateString('fr-FR')} — ${lignes.length} courrier(s)`,
      lignes,
    });
    ouvrirPdf(blob);
  }

  async function genererBordereau() {
    if (!parametres || !entiteDestinataire) return;
    const lignes = await construireLignes(selection);
    const entite = await db.entites.get(entiteDestinataire);
    const blob = await genererBordereauPdf({
      parametres,
      entiteDestinataire: entite?.libelle ?? '',
      dateAffichee: maintenant().toLocaleDateString('fr-FR'),
      lignes,
    });
    ouvrirPdf(blob);
    setOuvrirBordereau(false);
  }

  function surClicBordereau() {
    if (selection.size === 0) {
      toastErreur(t('registre.selectionRequise'));
      return;
    }
    setOuvrirBordereau(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('nav.registreEntrant')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variante="secondaire" onClick={exporterCsv}>
            <Download size={16} /> {t('registre.exporterCsv')}
          </Button>
          <Button variante="secondaire" onClick={exporterRegistrePdf}>
            <Download size={16} /> {t('registre.imprimerRegistre')}
          </Button>
          <Button variante="secondaire" onClick={surClicBordereau}>
            <FileStack size={16} /> {t('registre.genererBordereau')}
          </Button>
          <Button variante="primaire" onClick={() => navigate('/courriers/entrants/nouveau')}>
            {t('courrier.nouveauEntrant')}
          </Button>
        </div>
      </div>
      {selection.size > 0 && (
        <p className="mb-2 text-xs text-slate-400">{t('registre.selectionnes', { nombre: selection.size })}</p>
      )}
      <TableCourriers courriers={courriers} selection={selection} onBasculerSelection={basculerSelection} />

      {ouvrirBordereau && (
        <Modal titre={t('registre.genererBordereau')} onFermer={() => setOuvrirBordereau(false)}>
          <div className="space-y-3">
            <SelecteurEntite
              valeur={entiteDestinataire}
              onChange={setEntiteDestinataire}
              placeholder={t('courrier.entiteTraitante') ?? undefined}
            />
            <Button variante="primaire" disabled={!entiteDestinataire} onClick={genererBordereau}>
              {t('registre.genererBordereau')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

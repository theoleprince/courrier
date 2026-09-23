import { useRef, useState } from 'react';
import { Eye, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApercuDocument } from '@/components/courrier/ApercuDocument';

interface Props {
  fichiers: File[];
  onChange: (fichiers: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** Affiche l'aperçu du fichier sélectionné sous la liste (vrai par défaut). */
  apercu?: boolean;
}

export function ZoneDepot({
  fichiers,
  onChange,
  accept = 'application/pdf,image/png,image/jpeg',
  multiple = true,
  apercu = true,
}: Props): React.JSX.Element {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [survole, setSurvole] = useState(false);
  const [indexApercu, setIndexApercu] = useState(0);

  function ajouter(liste: FileList | null) {
    if (!liste || liste.length === 0) return;
    // Le premier fichier ajouté passe directement en aperçu.
    setIndexApercu(multiple ? fichiers.length : 0);
    onChange(multiple ? [...fichiers, ...Array.from(liste)] : [liste[0]]);
  }

  function retirer(index: number) {
    onChange(fichiers.filter((_, i) => i !== index));
    if (index < indexApercu || (index === indexApercu && index === fichiers.length - 1)) {
      setIndexApercu(Math.max(0, indexApercu - 1));
    }
  }

  const fichierApercu = fichiers[Math.min(indexApercu, fichiers.length - 1)];

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvole(true);
        }}
        onDragLeave={() => setSurvole(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvole(false);
          ajouter(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors ${
          survole
            ? 'border-[var(--couleur-primaire)] bg-[var(--couleur-primaire)]/5'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <Upload size={22} className="text-slate-400" />
        <span className="text-slate-500 dark:text-slate-400">{t('courrier.fichier')}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            ajouter(e.target.files);
            // Permet de resélectionner le même fichier après l'avoir retiré.
            e.target.value = '';
          }}
        />
      </div>

      {fichiers.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {fichiers.map((fichier, index) => {
            const actif = apercu && fichier === fichierApercu;
            return (
              <li
                key={`${fichier.name}-${index}`}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
                  actif
                    ? 'bg-[var(--couleur-primaire)]/10 text-[var(--couleur-primaire)]'
                    : 'bg-slate-50 dark:bg-slate-800'
                }`}
              >
                {apercu ? (
                  <button
                    type="button"
                    onClick={() => setIndexApercu(index)}
                    className="flex min-w-0 items-center gap-2 text-left"
                    title="Prévisualiser"
                  >
                    <Eye size={14} className="shrink-0" />
                    <span className="truncate">{fichier.name}</span>
                  </button>
                ) : (
                  <span className="truncate">{fichier.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => retirer(index)}
                  className="shrink-0 text-slate-400 hover:text-red-500"
                  title="Retirer"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {apercu && fichierApercu && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Aperçu : {fichierApercu.name}
          </p>
          <ApercuDocument blob={fichierApercu} />
        </div>
      )}
    </div>
  );
}

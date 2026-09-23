import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { imageEnPng } from '@/services/parametres';

export interface OptionsSignature {
  avecCachet: boolean;
}

interface Props {
  signatureExistante?: string;
  /** Cachet de l'organisation : si fourni, propose de l'apposer à côté de la signature. */
  cachet?: string;
  onValider: (dataUrl: string, options: OptionsSignature) => void;
  onAnnuler: () => void;
  enCours?: boolean;
}

export function PadSignature({ signatureExistante, cachet, onValider, onAnnuler, enCours }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const [vide, setVide] = useState(true);
  const [avecCachet, setAvecCachet] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, { backgroundColor: 'rgba(255,255,255,1)' });
    pad.addEventListener('endStroke', () => setVide(pad.isEmpty()));
    padRef.current = pad;
    return () => pad.off();
  }, []);

  function effacer() {
    padRef.current?.clear();
    setVide(true);
  }

  function reutiliser() {
    if (!signatureExistante || !padRef.current) return;
    padRef.current.fromDataURL(signatureExistante);
    setVide(false);
  }

  /** Charge une image de signature (scan, photo) dans la zone de tracé, centrée et à l'échelle. */
  async function importer(fichier: File | undefined) {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!fichier || !canvas || !pad) return;
    const dataUrl = await imageEnPng(fichier, 800);
    const image = new Image();
    image.onload = () => {
      const echelle = Math.min(canvas.offsetWidth / image.width, canvas.offsetHeight / image.height) * 0.9;
      const width = image.width * echelle;
      const height = image.height * echelle;
      pad.clear();
      void pad
        .fromDataURL(dataUrl, {
          width,
          height,
          xOffset: (canvas.offsetWidth - width) / 2,
          yOffset: (canvas.offsetHeight - height) / 2,
        })
        .then(() => setVide(false));
    };
    image.src = dataUrl;
  }

  function valider() {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onValider(padRef.current.toDataURL('image/png'), { avecCachet: !!cachet && avecCachet });
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full rounded border border-slate-300 bg-white dark:border-slate-600"
        style={{ touchAction: 'none' }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variante="discret" type="button" onClick={effacer}>
          {t('signature.effacer')}
        </Button>
        {signatureExistante && (
          <Button variante="discret" type="button" onClick={reutiliser}>
            {t('signature.reutiliser')}
          </Button>
        )}
        <Button variante="discret" type="button" onClick={() => fichierRef.current?.click()}>
          {t('signature.importerImage')}
        </Button>
        <input
          ref={fichierRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            void importer(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span className="ml-auto flex gap-2">
          <Button variante="secondaire" type="button" onClick={onAnnuler}>
            {t('commun.annuler')}
          </Button>
          <Button variante="primaire" type="button" onClick={valider} disabled={vide || enCours}>
            {t('signature.confirmer')}
          </Button>
        </span>
      </div>
      {cachet && (
        <label className="mt-3 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={avecCachet} onChange={(e) => setAvecCachet(e.target.checked)} />
          <img src={cachet} alt="" className="h-10 w-10 object-contain" />
          {t('signature.apposerCachet')}
        </label>
      )}
      <p className="mt-2 text-xs text-slate-400">{t('signature.mentionSimulee')}</p>
    </div>
  );
}

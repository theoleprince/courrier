import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

interface Props {
  signatureExistante?: string;
  onValider: (dataUrl: string) => void;
  onAnnuler: () => void;
  enCours?: boolean;
}

export function PadSignature({ signatureExistante, onValider, onAnnuler, enCours }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [vide, setVide] = useState(true);
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

  function valider() {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onValider(padRef.current.toDataURL('image/png'));
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
        <span className="ml-auto flex gap-2">
          <Button variante="secondaire" type="button" onClick={onAnnuler}>
            {t('commun.annuler')}
          </Button>
          <Button variante="primaire" type="button" onClick={valider} disabled={vide || enCours}>
            {t('signature.confirmer')}
          </Button>
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('signature.mentionSimulee')}</p>
    </div>
  );
}

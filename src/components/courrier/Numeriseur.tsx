import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Camera, Trash2 } from 'lucide-react';
import { assemblerFichiersEnPdf } from '@/services/documents';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Props {
  /** Reçoit le PDF assemblé (une page par photo), prêt à être joint au courrier. */
  onTermine: (pdf: File) => void;
  onFermer: () => void;
}

interface Page {
  fichier: File;
  url: string;
}

/**
 * Numérisation d'un courrier papier avec la caméra (webcam, ou caméra arrière d'un
 * téléphone / d'une tablette) : une photo par page, assemblées en un seul PDF.
 * Un scanner de bureau ne se pilote pas depuis un navigateur : on numérise alors
 * vers un fichier et on le sélectionne dans la zone de dépôt.
 */
export function Numeriseur({ onTermine, onFermer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [effetScanner, setEffetScanner] = useState(true);
  const [erreurCamera, setErreurCamera] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    async function demarrer() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreurCamera(i18n.t('numerisation.navigateurSansCamera'));
        return;
      }
      try {
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (annule) {
          flux.getTracks().forEach((piste) => piste.stop());
          return;
        }
        fluxRef.current = flux;
        if (videoRef.current) videoRef.current.srcObject = flux;
      } catch (erreur) {
        const nom = (erreur as DOMException).name;
        setErreurCamera(i18n.t(nom === 'NotAllowedError' ? 'numerisation.cameraRefusee' : 'numerisation.aucuneCamera'));
      }
    }
    void demarrer();
    return () => {
      annule = true;
      fluxRef.current?.getTracks().forEach((piste) => piste.stop());
    };
  }, []);

  // Libère les aperçus des pages à la fermeture seulement (pas à chaque ajout).
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  async function capturer() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    if (effetScanner) appliquerEffetScanner(ctx, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resoudre) => canvas.toBlob(resoudre, 'image/jpeg', 0.85));
    if (!blob) return;
    ajouterPages([new File([blob], `page-${pages.length + 1}.jpg`, { type: 'image/jpeg' })]);
  }

  function ajouterPages(fichiers: File[]) {
    setPages((liste) => [...liste, ...fichiers.map((fichier) => ({ fichier, url: URL.createObjectURL(fichier) }))]);
  }

  async function terminer() {
    if (pages.length === 0) return;
    setEnCours(true);
    try {
      const pdf = await assemblerFichiersEnPdf(pages.map((p) => p.fichier));
      const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      onTermine(new File([pdf], `numerisation-${horodatage}.pdf`, { type: 'application/pdf' }));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal titre={t('numerisation.titre')} onFermer={onFermer}>
      <div className="space-y-3">
        {erreurCamera ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p>{erreurCamera}</p>
            {/* Sur téléphone, ce champ ouvre directement l'appareil photo. */}
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 font-medium underline">
              <Camera size={16} /> {t('numerisation.prendrePhoto')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  ajouterPages(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="max-h-[50vh] w-full object-contain" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!erreurCamera && (
            <Button variante="primaire" type="button" onClick={() => void capturer()}>
              <Camera size={16} /> {t('numerisation.capturer', { numero: pages.length + 1 })}
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={effetScanner} onChange={(e) => setEffetScanner(e.target.checked)} />
            {t('numerisation.effetScanner')}
          </label>
        </div>
        <p className="text-xs text-slate-400">{t('numerisation.conseil')}</p>

        {pages.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((page, index) => (
              <li key={page.url} className="relative shrink-0">
                <img src={page.url} alt={t('numerisation.page', { numero: index + 1 })} className="h-24 rounded border border-slate-200 dark:border-slate-700" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">{index + 1}</span>
                <button
                  type="button"
                  title={t('numerisation.supprimerPage')}
                  onClick={() => {
                    URL.revokeObjectURL(page.url);
                    setPages((liste) => liste.filter((p) => p !== page));
                  }}
                  className="absolute right-1 top-1 rounded bg-white/90 p-1 text-slate-600 hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <Button variante="secondaire" type="button" onClick={onFermer}>
            {t('commun.annuler')}
          </Button>
          <Button variante="primaire" type="button" disabled={pages.length === 0 || enCours} onClick={() => void terminer()}>
            {t('numerisation.terminer', { count: pages.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Rendu « scanner » : niveaux de gris puis étirement du contraste entre les 5 % les
 * plus sombres et les 5 % les plus clairs, ce qui blanchit le fond et fonce l'encre.
 */
function appliquerEffetScanner(ctx: CanvasRenderingContext2D, largeur: number, hauteur: number): void {
  const image = ctx.getImageData(0, 0, largeur, hauteur);
  const d = image.data;
  const histogramme = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gris = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gris;
    histogramme[gris]++;
  }
  const total = largeur * hauteur;
  let cumul = 0;
  let bas = 0;
  let haut = 255;
  for (let v = 0; v < 256; v++) {
    cumul += histogramme[v];
    if (cumul < total * 0.05) bas = v;
    if (cumul < total * 0.95) haut = v;
  }
  // Image presque uniforme (page blanche, cadrage raté) : étirer amplifierait le bruit ; on garde les gris.
  const etendue = haut - bas;
  for (let i = 0; i < d.length; i += 4) {
    const v = etendue < 40 ? d[i] : Math.max(0, Math.min(255, ((d[i] - bas) * 255) / etendue));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

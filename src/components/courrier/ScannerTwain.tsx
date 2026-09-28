import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * Pilotage d'un scanner de bureau (TWAIN / WIA / ICA / SANE) avec Dynamic Web TWAIN
 * (Dynamsoft). Un navigateur n'a pas accès aux pilotes de scanner : la bibliothèque
 * passe par un petit service installé une fois sur chaque poste, et exige une clé de
 * licence (VITE_DWT_PRODUCT_KEY). Elle pèse ~150 Mo : on ne l'embarque pas, elle est
 * chargée depuis le CDN au premier clic seulement.
 */
const VERSION_DWT = '19.4.4';
const RESSOURCES = `https://cdn.jsdelivr.net/npm/dwt@${VERSION_DWT}/dist`;
const CLE_LICENCE: string = import.meta.env.VITE_DWT_PRODUCT_KEY ?? '';
const INSTALLEUR_WINDOWS = `${RESSOURCES}/dist/DynamicWebTWAINServiceSetup.msi`;

// Types minimaux de la partie de l'API utilisée (le paquet officiel n'est pas installé).
interface Peripherique {
  name: string;
  displayName: string;
}
interface ObjetTwain {
  GetDevicesAsync(): Promise<Peripherique[]>;
  SelectDeviceAsync(device: Peripherique): Promise<boolean>;
  AcquireImageAsync(config: Record<string, unknown>): Promise<boolean>;
  readonly HowManyImagesInBuffer: number;
  RemoveAllImages(): boolean;
  ConvertToBlob(
    indices: number[],
    type: number,
    succes: (resultat: Blob) => void,
    echec: (code: number, message: string) => void,
  ): void;
}
interface EspaceDwt {
  ResourcesPath: string;
  ProductKey: string;
  AutoLoad: boolean;
  UseDefaultViewer: boolean;
  Containers: unknown[];
  CreateDWTObjectEx(
    config: { WebTwainId: string },
    succes: (objet: ObjetTwain) => void,
    echec: (erreur: { code: number; message: string }) => void,
  ): void;
  DeleteDWTObject(id: string): boolean;
}
declare global {
  interface Window {
    Dynamsoft?: { DWT: EspaceDwt };
  }
}

const ID_OBJET = 'scanner-courrier';
const TYPE_PDF = 4; // EnumDWT_ImageType.IT_PDF
// EnumDWT_PixelType : 0 = noir et blanc, 1 = niveaux de gris, 2 = couleur.
const MODES_COULEUR = [0, 1, 2] as const;

let chargement: Promise<EspaceDwt> | undefined;

/** Charge une seule fois le script Dynamsoft depuis le CDN et le configure. */
function chargerDwt(): Promise<EspaceDwt> {
  chargement ??= new Promise<EspaceDwt>((resoudre, rejeter) => {
    const script = document.createElement('script');
    script.src = `${RESSOURCES}/dynamsoft.webtwain.min.js`;
    script.onload = () => {
      const dwt = window.Dynamsoft?.DWT;
      if (!dwt) return rejeter(new Error('scanner.bibliothequeIntrouvable'));
      dwt.ResourcesPath = RESSOURCES;
      dwt.ProductKey = CLE_LICENCE;
      dwt.AutoLoad = false;
      dwt.UseDefaultViewer = false;
      dwt.Containers = [];
      resoudre(dwt);
    };
    script.onerror = () => {
      chargement = undefined;
      rejeter(new Error('scanner.chargementImpossible'));
    };
    document.head.appendChild(script);
  });
  return chargement;
}

type Etat =
  | { etape: 'chargement' }
  | { etape: 'sans-licence' }
  | { etape: 'service-absent' }
  | { etape: 'erreur'; message: string }
  | { etape: 'pret' };

interface Props {
  onTermine: (pdf: File) => void;
  onFermer: () => void;
}

export function ScannerTwain({ onTermine, onFermer }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const objetRef = useRef<ObjetTwain | null>(null);
  const [etat, setEtat] = useState<Etat>(CLE_LICENCE ? { etape: 'chargement' } : { etape: 'sans-licence' });
  const [scanners, setScanners] = useState<Peripherique[]>([]);
  const [indexScanner, setIndexScanner] = useState(0);
  const [couleur, setCouleur] = useState<number>(1);
  const [resolution, setResolution] = useState(200);
  const [chargeur, setChargeur] = useState(true);
  const [rectoVerso, setRectoVerso] = useState(false);
  const [nbPages, setNbPages] = useState(0);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!CLE_LICENCE) return;
    let annule = false;
    chargerDwt()
      .then(
        (dwt) =>
          new Promise<void>((resoudre) => {
            dwt.CreateDWTObjectEx(
              { WebTwainId: ID_OBJET },
              async (objet) => {
                if (annule) return;
                objetRef.current = objet;
                objet.RemoveAllImages();
                const liste = await objet.GetDevicesAsync();
                if (annule) return;
                setScanners(liste);
                setEtat({ etape: 'pret' });
                resoudre();
              },
              // Le service local n'est pas joignable : il n'est pas installé (ou pas démarré) sur ce poste.
              () => {
                if (!annule) setEtat({ etape: 'service-absent' });
                resoudre();
              },
            );
          }),
      )
      .catch((e: Error) => !annule && setEtat({ etape: 'erreur', message: e.message }));
    return () => {
      annule = true;
      if (objetRef.current) window.Dynamsoft?.DWT.DeleteDWTObject(ID_OBJET);
      objetRef.current = null;
    };
  }, []);

  async function numeriser() {
    const objet = objetRef.current;
    const scanner = scanners[indexScanner];
    if (!objet || !scanner) return;
    setEnCours(true);
    try {
      await objet.SelectDeviceAsync(scanner);
      await objet.AcquireImageAsync({
        IfShowUI: false,
        PixelType: couleur,
        Resolution: resolution,
        IfFeederEnabled: chargeur,
        IfDuplexEnabled: rectoVerso,
        IfCloseSourceAfterAcquire: true,
      });
      setNbPages(objet.HowManyImagesInBuffer);
    } catch (e) {
      setEtat({ etape: 'erreur', message: (e as Error).message || t('scanner.echec') });
    } finally {
      setEnCours(false);
    }
  }

  function terminer() {
    const objet = objetRef.current;
    if (!objet || nbPages === 0) return;
    setEnCours(true);
    const indices = Array.from({ length: objet.HowManyImagesInBuffer }, (_, i) => i);
    objet.ConvertToBlob(
      indices,
      TYPE_PDF,
      (blob) => {
        const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
        onTermine(new File([blob], `scan-${horodatage}.pdf`, { type: 'application/pdf' }));
        setEnCours(false);
      },
      (_code, message) => {
        setEtat({ etape: 'erreur', message });
        setEnCours(false);
      },
    );
  }

  return (
    <Modal titre={t('scanner.bouton')} onFermer={onFermer}>
      <div className="space-y-4">
        {etat.etape === 'chargement' && <p className="text-sm text-slate-500">{t('scanner.connexion')}</p>}

        {etat.etape === 'sans-licence' && (
          <Encart>{t('scanner.sansLicence')}</Encart>
        )}

        {etat.etape === 'service-absent' && (
          <Encart>
            <p className="font-medium">{t('scanner.installationTitre')}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                {t('scanner.installationEtape1')}{' '}
                <a href={INSTALLEUR_WINDOWS} className="font-medium underline">
                  DynamicWebTWAINServiceSetup.msi
                </a>{' '}
                (Windows).
              </li>
              <li>{t('scanner.installationEtape2')}</li>
              <li>{t('scanner.installationEtape3')}</li>
            </ol>
          </Encart>
        )}

        {etat.etape === 'erreur' && <Encart>{etat.message.startsWith('scanner.') ? t(etat.message) : etat.message}</Encart>}

        {etat.etape === 'pret' &&
          (scanners.length === 0 ? (
            <Encart>{t('scanner.aucunScanner')}</Encart>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('scanner.scanner')}</span>
                <select className="champ" value={indexScanner} onChange={(e) => setIndexScanner(Number(e.target.value))}>
                  {scanners.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.displayName || s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('scanner.couleur')}</span>
                  <select className="champ" value={couleur} onChange={(e) => setCouleur(Number(e.target.value))}>
                    {MODES_COULEUR.map((m) => (
                      <option key={m} value={m}>
                        {t(`scanner.modeCouleur.${m}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('scanner.resolution')}</span>
                  <select className="champ" value={resolution} onChange={(e) => setResolution(Number(e.target.value))}>
                    {[150, 200, 300].map((r) => (
                      <option key={r} value={r}>
                        {t(r === 200 ? 'scanner.ppiRecommande' : 'scanner.ppi', { valeur: r })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={chargeur} onChange={(e) => setChargeur(e.target.checked)} /> {t('scanner.chargeur')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rectoVerso} onChange={(e) => setRectoVerso(e.target.checked)} /> {t('scanner.rectoVerso')}
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variante="primaire" type="button" disabled={enCours} onClick={() => void numeriser()}>
                  <Printer size={16} /> {t(nbPages === 0 ? 'scanner.numeriser' : 'scanner.numeriserAutres')}
                </Button>
                {nbPages > 0 && (
                  <span className="text-sm text-slate-600 dark:text-slate-300">{t('scanner.pagesNumerisees', { count: nbPages })}</span>
                )}
              </div>
            </>
          ))}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <Button variante="secondaire" type="button" onClick={onFermer}>
            {t('commun.annuler')}
          </Button>
          {etat.etape === 'pret' && (
            <Button variante="primaire" type="button" disabled={nbPages === 0 || enCours} onClick={terminer}>
              {t('numerisation.terminer', { count: nbPages })}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Encart({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      {children}
    </div>
  );
}

import { type PropsWithChildren, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Props {
  titre: string;
  onFermer: () => void;
}

export function Modal({ titre, onFermer, children }: PropsWithChildren<Props>): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer();
    }
    document.addEventListener('keydown', surEchap);
    ref.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    return () => document.removeEventListener('keydown', surEchap);
  }, [onFermer]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

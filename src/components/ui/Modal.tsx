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
    <div className="anim-fondu fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="anim-apparition w-full max-w-lg rounded-2xl border border-[var(--bordure)] bg-[var(--surface)] p-6 shadow-[var(--ombre-flottante)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

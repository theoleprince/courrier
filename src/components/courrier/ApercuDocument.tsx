import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ApercuDocument({ blob }: { blob: Blob | undefined }): React.JSX.Element {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-600">
        {t('courrier.aucunDocument')}
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title="Aperçu du document"
      className="h-full min-h-[500px] w-full rounded border border-slate-200 dark:border-slate-700"
    />
  );
}

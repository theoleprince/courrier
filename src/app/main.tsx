import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import { seedOrganisation } from '@/db/seed';
import { seedCourriers } from '@/db/seedCourriers';
import { initHorloge } from '@/services/horloge';
import { initialiserIndex } from '@/services/recherche';
import { verifierEcheances } from '@/services/notifications';
import { App } from '@/app/App';

async function demarrer() {
  await seedOrganisation();
  await initHorloge();
  await seedCourriers();
  await initialiserIndex();
  await verifierEcheances();
  setInterval(() => void verifierEcheances(), 60_000);

  const conteneur = document.getElementById('root');
  if (!conteneur) throw new Error('#root introuvable');

  createRoot(conteneur).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

demarrer().catch((erreur: unknown) => {
  const e = erreur as { message?: string; stack?: string; name?: string; inner?: unknown };
  console.error('Erreur au démarrage :', e?.name, '|', e?.message, '|', e?.stack, '|', e?.inner);
});

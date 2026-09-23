import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import { seedOrganisation } from '@/db/seed';
import { seedCourriers } from '@/db/seedCourriers';
import { db } from '@/db/db';
import { initHorloge } from '@/services/horloge';
import { initialiserIndex } from '@/services/recherche';
import { verifierEcheances } from '@/services/notifications';
import { App } from '@/app/App';

/** Exécute `fn` seul parmi tous les onglets ouverts (Web Locks), pour qu'un seul onglet génère les données. */
async function enExclusivite(fn: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return fn();
  await navigator.locks.request('gestion-courrier-seed', fn);
}

async function initialiserDonnees(): Promise<void> {
  // Génération précédente interrompue (onglet fermé ou rechargé) : base à moitié remplie
  // et horloge restée décalée. On repart de zéro.
  if ((await db.parametres.get('global'))?.seedEnCours) {
    await Promise.all(db.tables.map((table) => table.clear()));
  }
  await seedOrganisation();
  await initHorloge();
  await seedCourriers();
}

async function demarrer() {
  await enExclusivite(initialiserDonnees);
  await initHorloge();
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

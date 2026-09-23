import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Inbox,
  PenLine,
  Bell,
  BellRing,
  Search,
  FileSignature,
  Info,
  Send,
  Clock,
  Users,
  ScrollText,
  Network,
  GitBranch,
  Mail,
  Database,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useActeur } from '@/hooks/useActeur';
import { useParametres } from '@/hooks/useParametres';
import { useMesTaches } from '@/hooks/useMesTaches';
import { useNotifications } from '@/hooks/useNotifications';
import { useSessionStore } from '@/store/session';
import { postesDisponibles } from '@/services/organisation';
import { marquerNotificationLue, toutMarquerCommeLu } from '@/services/notifications';
import { rechercherGlobal, type ResultatRecherche } from '@/services/recherche';
import type { Poste } from '@/types/models';
import { BarreDemo } from '@/app/BarreDemo';

function LienNav({
  to,
  icone,
  libelle,
  badge,
  end,
}: {
  to: string;
  icone: React.ReactNode;
  libelle: string;
  badge?: number;
  end?: boolean;
}): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center justify-between gap-2 rounded px-3 py-2 text-sm ${
          isActive
            ? 'bg-[var(--couleur-primaire)]/10 font-medium text-[var(--couleur-primaire)]'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`
      }
    >
      <span className="flex items-center gap-2">
        {icone} {libelle}
      </span>
      {!!badge && (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>
      )}
    </NavLink>
  );
}

export function Layout(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const acteur = useActeur();
  const parametres = useParametres();
  const taches = useMesTaches();
  const notifications = useNotifications();
  const deconnecter = useSessionStore((s) => s.deconnecter);
  const changerPoste = useSessionStore((s) => s.changerPoste);
  const definirLangue = useSessionStore((s) => s.definirLangue);
  const [postesPossibles, setPostesPossibles] = useState<Poste[]>([]);
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [texteRecherche, setTexteRecherche] = useState('');
  const [resultatsRecherche, setResultatsRecherche] = useState<ResultatRecherche[]>([]);
  const rechercheRef = useRef<HTMLInputElement>(null);
  // Menu latéral en tiroir sous 768 px ; refermé à chaque changement de page.
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOuvert(false), [pathname]);

  useEffect(() => {
    const surLigne = () => setEnLigne(true);
    const horsLigne = () => setEnLigne(false);
    window.addEventListener('online', surLigne);
    window.addEventListener('offline', horsLigne);
    return () => {
      window.removeEventListener('online', surLigne);
      window.removeEventListener('offline', horsLigne);
    };
  }, []);

  useEffect(() => {
    if (!acteur) return;
    void postesDisponibles(acteur.personne).then(setPostesPossibles);
  }, [acteur]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement;
      const dansChamp = ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        rechercheRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n' && !dansChamp && acteur) {
        const cible2 =
          acteur.poste.role === 'ACCUEIL' || acteur.poste.role === 'BUREAU_ORDRE'
            ? '/courriers/entrants/nouveau'
            : '/courriers/sortants/nouveau';
        navigate(cible2);
      }
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [acteur, navigate]);

  async function surRecherche(valeur: string) {
    setTexteRecherche(valeur);
    if (!acteur || valeur.trim().length < 2) {
      setResultatsRecherche([]);
      return;
    }
    setResultatsRecherche(await rechercherGlobal(valeur, acteur, 8));
  }

  if (acteur === undefined) {
    return <div className="flex h-screen items-center justify-center">{t('commun.chargement')}</div>;
  }
  if (!acteur) return <></>;

  const estAdmin = acteur.poste.role === 'ADMIN';
  const estBureauOrdre = acteur.poste.role === 'BUREAU_ORDRE';
  const notificationsNonLues = (notifications ?? []).filter((n) => !n.lueLe);

  function seDeconnecter() {
    deconnecter();
    navigate('/connexion');
  }

  async function surClicNotification(courrierId: string, notifId: string) {
    await marquerNotificationLue(notifId);
    setNotifsOuvertes(false);
    navigate(`/courriers/${courrierId}`);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-2 sm:gap-4 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setMenuOuvert((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOuvert}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {menuOuvert ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex shrink-0 items-center gap-2 font-semibold text-[var(--couleur-primaire)]">
          {parametres?.logoPng && <img src={parametres.logoPng} alt="" className="h-8 w-8 rounded" />}
          <span className="hidden sm:inline">{parametres?.nomOrganisation ?? t('app.titre')}</span>
        </div>

        {/* Sur téléphone, la recherche passe par l'icône qui mène à /recherche. */}
        <div className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            ref={rechercheRef}
            value={texteRecherche}
            onChange={(e) => surRecherche(e.target.value)}
            onFocus={() => setRechercheOuverte(true)}
            onBlur={() => setTimeout(() => setRechercheOuverte(false), 150)}
            placeholder={`${t('recherche.placeholder')} (Ctrl+K)`}
            className="champ pl-9 text-sm"
          />
          {rechercheOuverte && resultatsRecherche.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {resultatsRecherche.map((r) => (
                <button
                  key={r.type === 'courrier' ? r.courrier.id : r.correspondant.id}
                  type="button"
                  onClick={() =>
                    navigate(r.type === 'courrier' ? (r.courrier.codeSuivi ? `/suivi/${r.courrier.codeSuivi}` : `/courriers/${r.courrier.id}`) : `/correspondants/${r.correspondant.id}`)
                  }
                  className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {r.type === 'courrier'
                    ? `${r.courrier.numero ?? r.courrier.codeSuivi} — ${r.objetAffiche}`
                    : r.correspondant.nom}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-sm sm:ml-0 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/recherche')}
            aria-label={t('nav.recherche') ?? undefined}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 sm:hidden dark:hover:bg-slate-800"
          >
            <Search size={18} />
          </button>
          <span title={enLigne ? undefined : t('commun.horsLigne') ?? undefined} className="text-slate-500">
            {enLigne ? <Wifi size={16} /> : <WifiOff size={16} />}
          </span>

          <div className="relative">
            <button
              type="button"
              aria-label={`Notifications (${notificationsNonLues.length} non lues)`}
              onClick={() => setNotifsOuvertes((v) => !v)}
              className="relative rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {notificationsNonLues.length > 0 ? <BellRing size={18} /> : <Bell size={18} />}
              {notificationsNonLues.length > 0 && (
                <span
                  data-testid="badge-notifications"
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white"
                >
                  {notificationsNonLues.length}
                </span>
              )}
            </button>
            {notifsOuvertes && (
              <div className="fixed inset-x-2 top-14 z-30 max-h-96 overflow-y-auto sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-80 rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <span className="text-xs font-semibold uppercase text-slate-400">Notifications</span>
                  {notificationsNonLues.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toutMarquerCommeLu(postesPossibles.map((p) => p.id))}
                      className="text-xs text-[var(--couleur-primaire)] hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                {(notifications ?? []).length === 0 && (
                  <p className="p-3 text-sm text-slate-400">{t('commun.aucunResultat')}</p>
                )}
                {(notifications ?? []).slice(0, 30).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => surClicNotification(n.courrierId, n.id)}
                    className={`block w-full border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 ${
                      n.lueLe ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {n.message}
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            aria-label={t('enTete.langue') ?? undefined}
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            value={i18n.language}
            onChange={(e) => definirLangue(e.target.value as 'fr' | 'en')}
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>

          {postesPossibles.length > 1 ? (
            <select
              aria-label={t('enTete.changerPoste') ?? undefined}
              className="max-w-[7rem] truncate rounded border sm:max-w-none border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
              value={acteur.poste.id}
              onChange={(e) => changerPoste(e.target.value)}
            >
              {postesPossibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                  {acteur.personne.posteId !== p.id ? ` ${t('connexion.interim')}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="hidden text-slate-600 md:inline dark:text-slate-300">{acteur.poste.libelle}</span>
          )}

          <span className="hidden font-medium md:inline">
            {acteur.personne.prenom} {acteur.personne.nom}
          </span>

          <button
            type="button"
            onClick={seDeconnecter}
            title={t('enTete.seDeconnecter') ?? undefined}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {menuOuvert && (
          <div
            className="absolute inset-0 z-30 bg-slate-900/40 md:hidden"
            onClick={() => setMenuOuvert(false)}
            aria-hidden="true"
          />
        )}
        <nav
          className={`${
            menuOuvert ? 'absolute inset-y-0 left-0 z-40 w-64 shadow-xl' : 'hidden'
          } shrink-0 space-y-1 overflow-y-auto border-r border-slate-200 bg-white p-3 md:static md:block md:w-56 md:shadow-none dark:border-slate-800 dark:bg-slate-900`}
        >
          <LienNav to="/" icone={<LayoutDashboard size={16} />} libelle={t('nav.tableauDeBord')} end />
          <LienNav to="/corbeille" icone={<Inbox size={16} />} libelle={t('nav.corbeille')} badge={taches?.corbeille} />
          <LienNav to="/parapheur" icone={<FileSignature size={16} />} libelle={t('nav.parapheur')} badge={taches?.parapheur} />
          <LienNav to="/information" icone={<Info size={16} />} libelle={t('nav.information')} badge={taches?.information} />
          <LienNav to="/recherche" icone={<Search size={16} />} libelle={t('nav.recherche')} />
          <LienNav to="/courriers/entrants" icone={<Mail size={16} />} libelle={t('nav.registreEntrant')} />
          <LienNav to="/courriers/sortants" icone={<PenLine size={16} />} libelle={t('nav.registreSortant')} />
          {estBureauOrdre && <LienNav to="/expeditions" icone={<Send size={16} />} libelle={t('nav.aExpedier')} />}
          <LienNav to="/reponses-attendues" icone={<Clock size={16} />} libelle={t('nav.reponsesAttendues')} />
          <LienNav to="/correspondants" icone={<Users size={16} />} libelle={t('nav.correspondants')} />

          {estAdmin && (
            <>
              <div className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('nav.administration')}
              </div>
              <LienNav to="/admin/organigramme" icone={<Network size={16} />} libelle="Organigramme" />
              <LienNav to="/admin/circuits" icone={<GitBranch size={16} />} libelle="Circuits" />
              <LienNav to="/admin/modeles-lettre" icone={<ScrollText size={16} />} libelle="Modèles de lettres" />
              <LienNav to="/admin/personnalisation" icone={<Settings size={16} />} libelle="Personnalisation" />
              <LienNav to="/admin/journal" icone={<ScrollText size={16} />} libelle="Journal d'audit" />
              <LienNav to="/admin/donnees" icone={<Database size={16} />} libelle="Données" />
            </>
          )}
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {parametres?.modeDemo && <BarreDemo />}
    </div>
  );
}

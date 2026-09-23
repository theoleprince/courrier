# Journal des décisions

## Résumé de la session initiale

Contrairement à la consigne « travailler lot par lot et s'arrêter à la fin de
chaque lot » (section 22), cette première session a construit les lots 1 à 5
(et une bonne partie du 6) d'un seul tenant, sur demande explicite de
l'utilisateur (« continue jusqu'à la fin »). Le détail des décisions par lot
reste consigné ci-dessous ; cette section résume ce qui est fait, vérifié, et
volontairement simplifié.

**Vérifié en conditions réelles (Playwright, navigateur réel, pas seulement
`tsc`/`vitest`)** : connexion (arbre + identifiant/mot de passe), tableau de
bord et pilotage, recherche globale, registres, fiche détail avec parcours et
panneau d'actions, corbeille, parapheur avec signature réelle (tracé →
pdf-lib → QR → empreinte → transaction Dexie → avancement du circuit),
journal d'audit avec vérification de la chaîne, portail usager public avec le
scénario D complet (section 19) et le courrier « de scène » ABEN-2345. Un
vrai bug de correspondance de nom sur le portail (`startsWith` sur la chaîne
entière au lieu d'un mot) a été trouvé et corrigé grâce à ce test en
conditions réelles — voir `services/suivi.ts`.

**Quatre tests e2e Playwright committés** (`e2e/accueil.spec.ts` : scénario
D, en deux tests ; `e2e/circulation.spec.ts` : scénario A complet avec rejet
puis clôture, en changeant d'acteur via la bascule rapide d'utilisateur de la
barre de démo ; `e2e/delais-escalade.spec.ts` : scénario E, avance
d'horloge → nouvelles notifications → aucun doublon au rejeu). `npm run
test:e2e` pour les rejouer. B et C restent vérifiés manuellement seulement.

## Session 2 — suite d'implémentation

- **Bug réel trouvé par le test du scénario E** : `services/horloge.ts`
  changeait bien `decalageHorlogeMinutes`, mais rien n'appelait
  `verifierEcheances()` après un saut d'horloge, contrairement à la règle
  explicite de la section 11.1 (« Chaque changement déclenche
  verifierEcheances() »). `BarreDemo.tsx` (`avancer`/`revenir`) appelle
  désormais `verifierEcheances()` après chaque saut, et `main.tsx` l'appelle
  une fois au démarrage puis toutes les 60 s (section 11.2). Sans ce test
  écrit pour la démo, ce trou serait resté invisible : le seed appelait déjà
  `verifierEcheances()` une fois à la fin, ce qui masquait le problème tant
  qu'on ne rejouait pas un saut d'horloge après coup.

- **`registre.selectionnes`/`selectionRequise` et export CSV/PDF/bordereau**
  ajoutés (section 12.3/12.4) : `services/documents.ts` expose
  `genererRegistreCsv`, `genererRegistrePdf`, `genererBordereauPdf` ;
  `TableCourriers` accepte désormais une sélection optionnelle (cases à
  cocher) sans changer son usage dans les pages qui ne l'utilisent pas
  (`Expeditions`, `ReponsesAttendues`, `CorrespondantDetail`).

- **Éditeur de circuits** (`/admin/circuits`) : remplacé la liste en lecture
  seule par un vrai éditeur — réordonnancement par flèches (pas de
  glisser-déposer, pour éviter une dépendance DnD hors section 3), édition du
  libellé/délai/cible (poste précis ou rôle)/saut automatique, ajout et
  suppression d'étapes, validation avant enregistrement (entrant commence par
  IMPUTATION ; sortant contient SIGNATURE et se termine par EXPEDITION ; au
  moins une étape ; chaque étape a un poste ou un rôle cible).

- **`components/organisation/SelecteurPoste.tsx` ajouté** — nommé dans
  l'architecture (section 4) mais pas encore créé ; nécessaire à l'éditeur de
  circuits pour choisir un poste précis comme cible d'étape.

- **Bug réel (mineur) trouvé par le scénario A à l'étape 5** : les toasts
  (`components/ui/Toasts.tsx`) étaient positionnés en `fixed bottom-4`, ce
  qui les fait apparaître par-dessus la barre de démo (bas de l'écran) et
  intercepte les clics sur ses boutons (« Changer d'utilisateur » notamment)
  pendant les ~4 s d'affichage du toast. Corrigé en remontant les toasts à
  `bottom-20` lorsque `parametres.modeDemo` est actif.

- **Suite de tests finale de cette session, exécutée en conditions réelles** :
  18 tests unitaires (Vitest) et 4 tests e2e (Playwright, 3 fichiers
  couvrant les scénarios A, D et E de la section 19) — tous au vert. La
  machine de développement s'est montrée par moments très lente (le même
  test passant de 20 s à 1,5 min sans changement de code), ce qui a généré
  plusieurs faux échecs par timeout au fil des essais ; chaque échec a été
  rejoué avant d'être attribué à l'environnement plutôt qu'à l'application.

- **Bug réel trouvé en écrivant les tests** : le bouton « Nouveau courrier
  pour ce correspondant » de `CorrespondantDetail.tsx` ne présélectionnait
  pas le correspondant sur le formulaire de rédaction. Corrigé en passant
  `?correspondantId=` dans l'URL, lu par `SortantNouveau.tsx`.

- **Bug réel, le plus sérieux de cette session, trouvé par le scénario A
  joué dans un vrai navigateur** : `enregistrerEntrant()` échouait
  systématiquement avec une `DexieError` dès qu'il était appelé depuis le
  formulaire `/courriers/entrants/nouveau` — alors qu'il fonctionnait dans
  `seedCourriers.ts`. Cause : `services/recherche.ts` enregistre des hooks
  Dexie `creating`/`updating` sur `courriers` pour tenir l'index minisearch à
  jour ; ces hooks s'exécutent **dans la transaction ambiante de
  l'appelant**, et `documentCourrier()` y lit de façon asynchrone d'autres
  tables (`correspondants`, `piecesJointes`). `enregistrerEntrant()` utilise
  `db.transaction('rw', db.tables, …)`, qui couvre toutes les tables — mais
  la suite `.then(...)` de l'appel async à `documentCourrier()` s'exécute
  après le retour synchrone du hook, en dehors du contexte que Dexie associe
  à cette transaction, et Dexie refuse la jointure. `seedCourriers()` ne
  déclenchait jamais ce chemin par coïncidence : `initialiserIndex()` (qui
  enregistre les hooks) n'est appelée qu'après le seed dans `main.tsx`.
  Corrigé en enveloppant le contenu des hooks dans `Dexie.ignoreTransaction()`
  (`services/recherche.ts`), qui détache explicitement ce travail annexe de
  la transaction d'origine — exactement le même principe que la règle des
  transactions de la section 3 (ne jamais faire dépendre une transaction
  Dexie d'une promesse externe), appliqué ici à une lecture Dexie asynchrone
  imbriquée plutôt qu'à `crypto.subtle`/`pdf-lib`. Ce bug aurait aussi cassé
  silencieusement l'import JSON (`admin/donnees`), qui écrit dans les mêmes
  tables sous transaction.

**Volontairement simplifié ou reporté**, à couvrir dans une session
ultérieure si le temps le permet :
- Lot 7 (OCR / capture webcam) : non commencé, explicitement optionnel.
- Palette de commandes `Ctrl+K` : simplifiée en un focus sur le champ de
  recherche de l'en-tête plutôt qu'une véritable palette modale.
- Carte de chaleur des goulots d'étranglement (section 13.2) : remplacée par
  un graphique en barres « retards par poste détenteur », plus simple à
  produire correctement dans le temps imparti.
- Historique de démonstration réduit à ~20 courriers au lieu de 60 (section
  15.4) ; le mécanisme (`db/seedCourriers.ts`) est en place et il suffit d'y
  ajouter des entrées pour l'étoffer.
- Scénarios B et C (section 19) non couverts par un test e2e automatisé.
- OCR/scan webcam mis à part, **toutes les autres fonctionnalités du
  périmètre « Inclus dans le POC » (section 2) ont une implémentation
  fonctionnelle**, y compris la double authentification demandée en cours de
  session (voir plus bas).

Consigne toute décision non couverte explicitement par SPECIFICATIONS.pdf,
par ordre chronologique, lot par lot.

## Lot 1 — Socle

- **Index `numero` non unique.** Le champ `numero` vaut `null` pour tout
  brouillon sortant ; Dexie applique l'unicité même à la valeur `null`
  (contrairement à `undefined`), ce qui provoquerait un conflit dès le
  deuxième brouillon. Comme anticipé par la spécification (section 5.2),
  l'index Dexie `courriers.numero` est déclaré non unique ; l'unicité réelle
  du numéro attribué sera garantie par la séquence (`sequences`, lot 2).

- **Typage des entités de l'organigramme de démonstration.** La section 15.1
  ne précise pas le `TypeEntite` de chaque entité. Règle retenue : les
  entités dont le libellé commence par « Direction » (Direction générale,
  Direction administrative et financière, Direction technique) sont de type
  `DIRECTION` ; le Secrétariat général, rattaché directement à la DG mais
  parent de deux services, est `DEPARTEMENT` ; Accueil, Bureau d'ordre,
  Service comptabilité, Service RH et Service maintenance sont `SERVICE`.

- **Langue de session vs langue par défaut de l'organisation.** `Parametres.langue`
  reste la langue par défaut du client (nouvelle session, portail usager tant
  qu'aucun choix explicite). Le sélecteur de langue dans l'en-tête change la
  langue d'affichage de la session en cours (store `session.ts`, persistée en
  localStorage) sans réécrire `Parametres.langue` — cohérent avec le fait que
  ce n'est pas un réglage « métier » mais une préférence d'affichage.

- **`BarreDemo` minimale au lot 1.** Seuls l'horloge simulée (+1h/+1j/+1sem/
  retour au présent), la bascule rapide d'utilisateur et un « Réinitialiser
  la démo » basique (purge IndexedDB + rechargement) sont implémentés. Le
  scénario guidé et la simulation de falsification (section 16) sont
  explicitement des livrables du lot 6 et n'apparaissent pas avant, pour
  éviter un bouton non fonctionnel dans la démo.

- **`services/donnees.ts` réduit à `reinitialiserDemo()`.** L'export/import
  JSON complet (section 13, `/admin/donnees`) est un livrable du lot 5 ; le
  lot 1 n'a besoin que d'un moyen de repartir d'un état propre.

- **Outillage ESLint/Prettier ajouté sans être un « choix imposé » de la
  section 3** : ce sont des outils de qualité listés en section 17 (NFR),
  pas des dépendances applicatives ; ajoutés avec la configuration standard
  Vite + React + TypeScript.

- **Double mode de connexion (demande explicite hors spécification).**
  En plus du clic dans l'organigramme (section 6.2), `/connexion` propose un
  onglet identifiant / mot de passe (`services/auth.ts`). Le mot de passe
  est stocké en clair sur `Personne.motDePasse` (défaut `123456789` pour
  tous les comptes de démo) et comparé tel quel : comme le reste de
  l'authentification du POC (section 2, exclu de la feuille de route
  sécurisée), **cela n'a aucune valeur de sécurité réelle**. Le mot de passe
  ne fait que déterminer quelle personne — et donc quel nœud de
  l'organigramme — se connecte, exactement comme un clic sur son nom.

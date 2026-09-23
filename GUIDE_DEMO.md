# Guide de démonstration — Gestion du courrier

Durée : 15 à 20 minutes. Chaque étape indique **avec qui se connecter** 👤 et **quoi faire**.

---

## 0. Qui est qui (antisèche)

Connexion : `/connexion` → clic sur le nom dans l'organigramme, **ou** identifiant + mot de passe `123456789`.
En cours de démo : barre démo (en bas) → **« Changer d'utilisateur »** → clic sur le nom.

| 👤 Personne | Poste | Rôle dans la démo |
|---|---|---|
| **Paul Mbarga** | Directeur général | Tableau de bord, parapheur, signature en lot |
| **Aïcha Bello** | Secrétaire générale | Imputation des courriers entrants |
| **Admin POC** | Administrateur fonctionnel | Personnalisation, circuits, journal d'audit |
| **Mireille Ondoa** | Chargée d'accueil | Recherche, fiche de suivi, réponse à l'usager |
| **Carine Ngo Bassong** | Agent du bureau d'ordre | Enregistrement des entrants, expédition des sortants |
| **Ernest Fouda** | Chef du bureau d'ordre | (optionnel) Registre, bordereaux |
| **Samuel Tchoupo** | Directeur administratif et financier (DAF) | Visa, rejet, rédaction de réponse |
| **Grâce Eyenga** | Chef comptabilité (+ intérim chef RH) | Traitement des factures |
| **Hervé Kamga** | Directeur technique | Rejet d'un sortant (cas bonus) |
| **Josiane Atangana** | Chef maintenance | Visa d'un sortant (cas bonus) |
| **Rodrigue Essomba** | Technicien | Rédaction d'un sortant (cas bonus) |

Personnes non utilisées dans le script : Idriss Moussa (comptable), Brenda Nkeng (chef RH).

---

## 1. Préparation (la veille et 5 minutes avant)

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1.1 | — | Lancer l'appli accessible au téléphone : `npm run dev -- --host`, noter l'IP locale (ex. `http://192.168.1.20:5173`). Téléphone sur le même Wi‑Fi. |
| 1.2 | **Admin POC** | `/admin/personnalisation` : logo, nom, adresse et couleurs du prospect. |
| 1.3 | **Admin POC** | `/admin/organigramme` : renommer 2–3 entités avec les noms réels du prospect. |
| 1.4 | **Paul Mbarga** | `/parapheur` : signer un courrier, télécharger le PDF signé. Faire une **copie modifiée** (ouvrir dans Edge → ajouter une annotation → enregistrer sous `signe_modifie.pdf`). Garder les deux fichiers sur le bureau. |
| 1.5 | — | Barre démo → **« Réinitialiser la démo »** (juste avant la présentation, après l'étape 1.4). |
| 1.6 | — | Tester l'imprimante et l'appareil photo du téléphone. Imprimer ce guide. |

---

## 2. Script de la démonstration

Fil rouge — 5 promesses : **Rien ne se perd · Chacun sait où en est un dossier · Les délais sont tenus · La signature ne bloque plus · La traçabilité est inviolable.**

### Cas 1 — Ouverture (1 min)

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Paul Mbarga** | Rester sur le tableau de bord `/`. Montrer que l'appli est aux couleurs du prospect. |

> 🎤 « Aujourd'hui, combien de temps faut-il pour savoir où se trouve un courrier ? »

---

### Cas 2 — L'arrivée d'un courrier (2 min) · *Rien ne se perd*

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Carine Ngo Bassong** | `/courriers/entrants/nouveau` : Objet « Facture fournitures de bureau », Correspondant **Bureautique Plus**, Type **FACTURE**, joindre un PDF → **Enregistrer**. |
| 2 | **Carine Ngo Bassong** | Montrer : numéro **ARR-…**, **code de suivi**, **récépissé PDF avec QR code**. Imprimer le récépissé et le remettre au jury. |
| 3 | **Carine Ngo Bassong** | Cliquer **« Voir le détail complet »** → noter/garder l'URL (utilisée au cas 4). |
| 4 | **Carine Ngo Bassong** | `/courriers/entrants` : montrer le registre chronologique, export PDF / CSV. |

> 🎤 « Chaque courrier a une identité dès la seconde où il entre. »

---

### Cas 3 — L'appel de l'usager (2 min) · *Chacun sait où en est un dossier* — ⭐ MOMENT CLÉ

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Mireille Ondoa** | `/recherche` → taper **« abena »** → résultat immédiat. |
| 2 | **Mireille Ondoa** | Ouvrir la fiche de suivi **ABEN-2345** : « En cours de traitement par la Direction administrative et financière, depuis 1 jour, réponse estimée avant le… » |
| 3 | **Mireille Ondoa** | **« Copier un message pour l'usager »** → texte prêt pour un SMS. |
| 4 | 📱 Téléphone (aucune connexion) | Ouvrir `http://<IP>:5173/portail` → code **ABEN-2345** + **« Abe »** → **Vérifier** → même statut, version publique. |
| 5 | 📱 Téléphone (aucune connexion) | Scanner avec l'appareil photo le QR du récépissé imprimé au cas 2 → le portail s'ouvre sur ce courrier. |
| 6 | **Mireille Ondoa** | `/courriers/entrants` → montrer une ligne « **Courrier confidentiel** » : l'accueil ne voit ni l'objet ni les personnes. |

> 🎤 « Fini les appels sans réponse. L'usager peut même vérifier seul. »

---

### Cas 4 — La circulation (3 min) · *Chacun sait ce qu'il a à faire*

On reprend la facture créée au cas 2 (ouvrir son URL après chaque changement d'utilisateur, ou passer par la Corbeille).

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Aïcha Bello** | `/corbeille` → ouvrir la facture → montrer la **suggestion d'imputation** → choisir **Service comptabilité** → **Imputer**. Utiliser **« Diffuser pour information »** vers le DAF. |
| 2 | **Grâce Eyenga** | En passant : montrer la **bascule de poste** dans l'en-tête (elle assure l'intérim du chef RH). Ouvrir la facture → **« Marquer comme traité »**. |
| 3 | **Samuel Tchoupo** | Ouvrir la facture → **Rejeter** → tenter de valider **sans motif** (refusé) → saisir « Pièce justificative manquante » → **Rejeter**. Le dossier retourne chez Grâce. |
| 4 | **Grâce Eyenga** | Ouvrir la facture → voir le motif du rejet → **« Marquer comme traité »**. |
| 5 | **Samuel Tchoupo** | Ouvrir la facture → **Viser** → tracer le paraphe → statut **Clôturé** (« Traité le … »). Le document affiché porte le cachet **« LU ET APPROUVÉ »** sur chaque page (variante : « Ou viser à la main » → imprimer, viser sur papier, téléverser le scan). |
| 6 | **Samuel Tchoupo** | Montrer la timeline du parcours sur la fiche, puis `/information` : la facture diffusée « Pour information ». |

> 🎤 « Chacun sait ce qu'il a à faire, et tout est tracé. »

---

### Cas 5 — La signature (2–3 min) · *La signature ne bloque plus*

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Carine Ngo Bassong** | `/courriers/entrants/nouveau` : lettre de **Banque Atlantique Centrale**, cocher **« Réponse attendue »** (délai 5 jours) → **Enregistrer**. |
| 2 | **Aïcha Bello** | Ouvrir la lettre → imputer à la **Direction administrative et financière** → **Imputer**. |
| 3 | **Samuel Tchoupo** | Ouvrir la lettre → **Rédiger** → modèle **« Réponse favorable »** : objet, numéro et date se remplissent seuls, papier à en-tête → **Soumettre au circuit**. Visa et validation **sautés automatiquement** (Samuel est déjà directeur) → direction parapheur du DG. |
| 4 | **Samuel Tchoupo** | Revenir sur la lettre de la banque → **« Marquer comme traité »** → statut « en attente de réponse ». |
| 5 | **Paul Mbarga** | `/parapheur` → **cocher 3 courriers** (dont la réponse à la banque) → **Signer** → tracer la signature **une seule fois** → les 3 sont signés. |
| 6 | **Paul Mbarga** | Ouvrir un PDF signé → montrer le **QR de vérification**. |
| 7 | **Carine Ngo Bassong** | `/expeditions` → **Expédier** la réponse → numéro **DEP-…** ; l'entrant de la banque passe **Clôturé**. |

> 🎤 « Le DG signe depuis n'importe où, en quelques secondes, et en lot. »

---

### Cas 6 — Le pilotage (2 min) · *Les délais sont tenus*

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Paul Mbarga** | Tableau de bord `/` : délais moyens, retards, **goulot sur la « Validation du directeur » de la Direction technique**. Noter le chiffre du badge de notifications. |
| 2 | **Paul Mbarga** | Barre démo → **« +1 semaine »** → le badge de notifications augmente, escalades vers les supérieurs, tableau de bord mis à jour. |
| 3 | **Paul Mbarga** | Barre démo → **« Revenir au présent »**, puis **« +1 semaine »** à nouveau → **aucune notification en double**. |
| 4 | **Paul Mbarga** | `/reponses-attendues` → montrer un courrier dont la réponse est hors délai. |
| 5 | **Paul Mbarga** | Barre démo → **« Revenir au présent »** (important pour la suite). |

> 🎤 « Les retards deviennent visibles et remontent tout seuls. »

---

### Cas 7 — La confiance (1 min) · *Traçabilité inviolable*

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Admin POC** | `/admin/journal` → **Vérifier** la chaîne → ✅ intègre. |
| 2 | **Admin POC** | **« Simuler une falsification »** → Vérifier → ❌ « Falsification détectée à la séquence N ». |
| 3 | Aucune (page publique) | `/verifier` → déposer le PDF signé (préparation 1.4) → ✅ **authentique**. |
| 4 | Aucune (page publique) | Déposer `signe_modifie.pdf` → ❌ **« Ce document a été modifié après signature »**. |

> 🎤 « Personne, même un administrateur, ne peut réécrire l'historique sans que cela se voie. »

---

### Cas 8 — Clôture (2 min)

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Paul Mbarga** | Couper le Wi‑Fi → bandeau « hors ligne » → continuer à naviguer (ouvrir un courrier, le tableau de bord). Rétablir le Wi‑Fi. |
| 2 | **Paul Mbarga** | Sélecteur de langue dans l'en-tête → **EN** → toute l'interface en anglais. Revenir en FR. |
| 3 | **Admin POC** | `/admin/circuits` → ajouter une étape à un circuit en direct → enregistrer. Seuls les nouveaux courriers seront concernés. |
| 4 | — | Présenter la feuille de route (section 5) puis questions. |

---

## 3. Cas bonus (si le jury demande)

### Sortant rejeté puis resoumis

| # | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| 1 | **Rodrigue Essomba** | `/courriers/sortants/nouveau` → rédiger un courrier (ex. à Transports Nkolbisson) → **Soumettre au circuit**. |
| 2 | **Josiane Atangana** | Ouvrir le courrier → **Viser**. |
| 3 | **Hervé Kamga** | Ouvrir le courrier → **Rejeter** avec motif. |
| 4 | **Rodrigue Essomba** | Ouvrir le courrier → **Nouvelle version** (déposer la v2) → **Resoumettre**. |
| 5 | **Josiane Atangana** → **Hervé Kamga** | Viser, puis Valider. |
| 6 | **Paul Mbarga** | `/parapheur` → Signer. |
| 7 | **Carine Ngo Bassong** | `/expeditions` → Expédier. Montrer que **v1 et v2 restent consultables** sur la fiche. |

### Autres démonstrations rapides

| Démo | 👤 Se connecter avec | Faire quoi |
|---|---|---|
| Vue 360° correspondant | **Carine Ngo Bassong** | `/correspondants` → Banque Atlantique Centrale → historique entrants/sortants → « Nouveau courrier pour ce correspondant ». |
| Bordereau de transmission | **Ernest Fouda** | `/courriers/entrants` → cocher des courriers → **Bordereau PDF**. |
| Convocation urgente | **Aïcha Bello** | `/corbeille` → Convocation du Cabinet Ekambi (très urgente) → imputer. |
| Signature refusée sans habilitation | **Aïcha Bello** | Montrer qu'elle n'a pas de parapheur / ne peut pas signer (poste sans droit de signature). |
| Accès confidentiel refusé | **Mireille Ondoa** | Tenter d'ouvrir un courrier confidentiel → objet et personnes masqués. |

---

## 4. Arguments par interlocuteur

| Interlocuteur | Cas à mettre en avant |
|---|---|
| Directeur général | Cas 5 (parapheur, signature en lot), Cas 6 (tableau de bord) |
| Secrétaire général / bureau d'ordre | Cas 2 (récépissé, registre), Cas 4 (suggestion d'imputation), bordereaux |
| Accueil / relation usagers | Cas 3 (recherche, statut en clair, portail) |
| DSI | Hors ligne, bilingue, intégrité, feuille de route technique |
| Audit / conformité | Cas 7 (journal chaîné, vérification des signatures), confidentialité |

---

## 5. Feuille de route (après le marché)

- Backend Spring Boot + PostgreSQL, API REST, authentification annuaire (LDAP / Active Directory), SSO.
- Signature électronique qualifiée (certificats, horodatage), conformité au cadre légal local.
- Application mobile (Flutter) pour le parapheur et les validations en déplacement.
- Réception automatique des e-mails et formulaires en ligne ; notifications SMS / WhatsApp aux usagers.
- OCR et classification automatique ; GED et archivage à valeur probante.
- Hébergement sur site ou cloud local, sauvegardes, haute disponibilité.

---

## 6. Questions probables

| Question | Réponse |
|---|---|
| « Et si internet coupe ? » | Le POC fonctionne entièrement hors ligne ; la version cible synchronise au retour de la connexion. |
| « La signature a-t-elle une valeur légale ? » | Pas dans le POC ; la version cible s'appuie sur des certificats qualifiés. |
| « Peut-on adapter les circuits nous-mêmes ? » | Oui → démo en direct de `/admin/circuits` (Admin POC). |
| « Et nos courriers papier existants ? » | Numérisation au guichet, OCR (feuille de route), registre chronologique pour la continuité. |

---

## 7. ⚠️ Pièges à éviter

1. **Pas de « Scénario guidé » à l'écran** → suivre ce guide imprimé ou sur un second écran.
2. **Pas de lecteur QR dans l'appli** → scanner avec l'appareil photo du téléphone. Le téléphone doit joindre la machine (`--host` + IP) : avec `localhost`, le QR ne mène nulle part.
3. **Pas de bouton « Télécharger une version modifiée »** → utiliser le PDF modifié préparé à l'étape 1.4.
4. **OCR / scan webcam non développés** → les présenter comme feuille de route uniquement.
5. **~20 courriers d'historique seulement** → ne pas promettre de volume sur le tableau de bord.
6. **Toujours « Revenir au présent »** après le cas 6, sinon les délais affichés ensuite sont faux.
7. **Réinitialiser la démo avant chaque passage** → les courriers de scène (ABEN-2345, convocation Ekambi, réponse Banque) reviennent à leur état exact.
8. Si un toast masque la barre démo, attendre ~4 s avant de cliquer sur « Changer d'utilisateur ».

# Guide de tournage — Vidéo de présentation « Gestion du courrier »

Vidéo client de **12 à 15 minutes**, en **5 séquences** tournées séparément puis montées.
Chaque plan indique **qui est connecté** 👤, **ce qu'on fait à l'écran** et **ce que dit la voix off** 🎤.

| # | Séquence | Durée visée |
|---|---|---|
| 0 | Introduction | 0 min 45 |
| 1 | Courrier entrant simple : une facture | 3 min 30 |
| 2 | Courrier entrant avec réponse | 3 min 30 |
| 3 | Courrier sortant | 2 min 30 |
| 4 | Configuration : circuits et paramétrage | 3 min 30 |
| 5 | Conclusion | 0 min 30 |

---

## 1. Préparation (avant de lancer l'enregistrement)

### Matériel et écran

| # | À faire |
|---|---|
| 1 | Écran en **1920 × 1080**, navigateur en plein écran (**F11**), zoom **110 %** (Ctrl +) pour que le texte reste lisible en vidéo. |
| 2 | Fermer les notifications Windows, Teams, Outlook. Masquer la barre des favoris. |
| 3 | Les **3 PDF** sont dans le dossier **`video-courrier`** du bureau : `facture-bureautique-plus.pdf` (séquence 1), `lettre-banque.pdf` (séquence 2), `scan-vise.pdf` (la facture imprimée, visée à la main et scannée, pour le plan « Ou viser à la main »). |
| 4 | Enregistreur d'écran avec **surbrillance du curseur** et des clics (OBS, Camtasia…). Micro séparé pour la voix off, enregistrée après coup de préférence. |

### Données

| # | 👤 Connecté | À faire |
|---|---|---|
| 5 | **Admin POC** | `/admin/personnalisation` : logo, nom et couleur du client, **cachet numérique** (image PNG du tampon). Enregistrer. |
| 6 | **Admin POC** | `/admin/organigramme` : renommer 2–3 entités avec les noms réels du client (facultatif mais très parlant). |
| 7 | — | Barre démo (en bas) → **« Réinitialiser la démo »**. À refaire avant chaque nouvelle prise complète. |
| 8 | — | Replier la barre démo avec la flèche ⌄ à droite : elle reste disponible mais discrète à l'image. |

### Changer d'utilisateur pendant le tournage

Deux façons, à choisir selon le rendu voulu :
- **Rapide** : barre démo → **« Changer d'utilisateur »** → clic sur le nom. À couper au montage.
- **Propre à l'image** : icône de déconnexion en haut à droite → page de connexion → clic sur le nom dans l'organigramme. Montre au passage la connexion par organigramme.

> Astuce montage : insérer un **carton** « Connecté en tant que : Secrétaire générale » à chaque changement de personne. Le client suit mieux qui fait quoi.

### Qui fait quoi dans la vidéo

| 👤 Personne | Poste | Séquences |
|---|---|---|
| **Carine Ngo Bassong** | Agent du bureau d'ordre | 1, 2, 3 (enregistrement, expédition) |
| **Aïcha Bello** | Secrétaire générale | 1, 2 (imputation) |
| **Grâce Eyenga** | Chef du service comptabilité | 1 (traitement de la facture) |
| **Samuel Tchoupo** | Directeur administratif et financier | 1, 2 (visa, rédaction de la réponse) |
| **Paul Mbarga** | Directeur général | 0, 2, 3, 5 (tableau de bord, parapheur) |
| **Rodrigue Essomba** | Technicien | 3 (rédaction d'un sortant) |
| **Josiane Atangana** | Chef du service maintenance | 3 (visa) |
| **Hervé Kamga** | Directeur technique | 3 (validation) |
| **Admin POC** | Administrateur fonctionnel | 4 (configuration) |

Mot de passe de tous les comptes, si besoin : `123456789`.

---

## 2. Script

### Séquence 0 — Introduction (0 min 45)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 0.1 | — | Page de connexion : l'organigramme du client. |
| 0.2 | **Paul Mbarga** | Clic sur son nom → tableau de bord. Survoler les indicateurs (reçus, en cours, en retard) puis le graphique des retards. |

> 🎤 « Chaque jour, votre organisation reçoit et envoie des dizaines de courriers. Où sont-ils ? Qui doit les traiter ? Sont-ils en retard ? Voici comment la solution répond à ces trois questions, du guichet jusqu'à la signature du Directeur général. »

---

### Séquence 1 — Courrier entrant simple : une facture (3 min 30)

**Message clé :** *rien ne se perd, chacun sait ce qu'il a à faire.*
Circuit appliqué automatiquement : **Imputation (SG) → Contrôle comptable → Visa du DAF.**

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 1.1 | **Carine** (bureau d'ordre) | Menu **Registre entrant** → **« Enregistrer un courrier »**. Glisser `facture-bureautique-plus.pdf` dans la zone Document. Objet « Facture fournitures de bureau », Correspondant **Bureautique Plus**, Type **Facture** → **Enregistrer**. |
| 1.2 | **Carine** | Fenêtre de confirmation : **code de suivi** en grand et **numéro ARR-…** → **« Enregistrer et imprimer le récépissé »** : le PDF du récépissé s'ouvre avec son **QR code**. Fermer, puis **« Voir le détail complet »**. |
| 1.3 | **Carine** | Revenir au **Registre entrant** : le courrier est en tête de liste, statut « Reçu, en cours d'orientation ». |

> 🎤 « Dès son arrivée, le courrier est numérisé, numéroté et horodaté. Le déposant repart avec un récépissé : son code de suivi et un QR code lui permettent de suivre son dossier en ligne. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 1.4 | **Aïcha** (SG) | **Ma corbeille** : la facture est arrivée, avec son échéance. L'ouvrir : aperçu du document à gauche, actions à droite. |
| 1.5 | **Aïcha** | Cliquer **« Suggestions »** → l'appli propose le **Service comptabilité** avec sa justification. Le choisir. |
| 1.6 | **Aïcha** | **« Diffuser pour information »** → choisir **Directeur administratif et financier** → valider. Puis **Imputer**. |

> 🎤 « La Secrétaire générale oriente le courrier en un clic. L'application lui suggère le bon service d'après l'historique. Elle peut aussi mettre un directeur en copie pour information. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 1.7 | **Grâce** (chef comptabilité) | **Ma corbeille** → ouvrir la facture → saisir un commentaire « Montant conforme au bon de commande » → **« Marquer comme traité »**. |
| 1.8 | **Samuel** (DAF) | **Ma corbeille** → ouvrir la facture → **Viser** → tracer son paraphe dans la fenêtre → valider. |
| 1.9 | **Samuel** | Le document affiché porte désormais le cachet **« LU ET APPROUVÉ »** avec nom, poste et date, **sur chaque page**. Le statut passe **« Traité le … »**. |
| 1.10 | **Samuel** | Onglet **Parcours** : la frise montre chaque étape, qui l'a faite et quand. Puis menu **Pour information** : la facture y figure (diffusion de l'étape 1.6). |

> 🎤 « Chacun trouve dans sa corbeille ce qu'il a à faire, avec l'échéance. Le visa laisse une trace sur le document lui-même : le paraphe et la mention "Lu et approuvé" sur chaque page. Et l'historique complet reste consultable. »

*Plan de coupe facultatif (15 s) :* sur la même fiche, montrer l'encart **« Ou viser à la main »** (imprimer → viser sur papier → téléverser `scan-vise.pdf`).
> 🎤 « Ceux qui préfèrent le papier peuvent imprimer, viser à la main et remettre le scan dans le circuit. »

---

### Séquence 2 — Courrier entrant avec réponse (3 min 30)

**Message clé :** *la réponse part dans les délais, et le dossier se clôture tout seul.*

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 2.1 | **Carine** | **« Enregistrer un courrier »** : `lettre-banque.pdf`, Objet « Demande de relevé annuel », Correspondant **Banque Atlantique Centrale**, Type **Lettre**. Cocher **« Réponse attendue »** → date limite dans 5 jours. |
| 2.2 | **Carine** | Montrer le champ **« E-mail pour la réponse »** : prérempli avec l'adresse de la banque. → **Enregistrer**. |

> 🎤 « Quand une réponse est attendue, on fixe le délai et l'adresse à laquelle répondre. L'échéance est surveillée dès cet instant. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 2.3 | **Aïcha** | Corbeille → ouvrir la lettre → choisir **Direction administrative et financière** → **Imputer**. |
| 2.4 | **Samuel** | Corbeille → ouvrir la lettre → **« Rédiger »**. |
| 2.5 | **Samuel** | Choisir le modèle **« Réponse favorable »** : l'objet, la référence du courrier reçu et la date se remplissent seuls. L'**e-mail du destinataire** est repris de la lettre. Cliquer **« Aperçu de la lettre »** : papier à en-tête du client. |
| 2.6 | **Samuel** | **« Soumettre au circuit »**. Montrer sur la fiche que le visa et la validation sont **sautés automatiquement** : Samuel est lui-même directeur, la réponse part directement au parapheur du DG. |

> 🎤 « La réponse se rédige depuis le courrier reçu, à partir de modèles. Pas de double saisie. Le circuit s'adapte : une étape qui ferait valider quelqu'un par lui-même est sautée automatiquement. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 2.7 | **Paul** (DG) | Menu **Parapheur** : les courriers à signer. **Cocher la réponse à la banque et 2 autres** → **« Signer la sélection »**. |
| 2.8 | **Paul** | Tracer la signature **une seule fois**, cocher **« Apposer le cachet de l'organisation »** → valider. Les 3 courriers sont signés. |
| 2.9 | **Paul** | Ouvrir la réponse signée : signature, cachet, et **QR code de vérification** en bas de page. |

> 🎤 « Le Directeur général signe en lot, depuis son bureau ou en déplacement. Chaque document signé porte un QR code : n'importe qui peut vérifier qu'il n'a pas été modifié. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 2.10 | **Carine** | Menu **À expédier** → ouvrir la réponse → Mode d'envoi **E-mail** : l'adresse de la banque est déjà là → **Expédier**. Numéro **DEP-…** attribué. |
| 2.11 | **Carine** | Rouvrir la lettre de la banque (registre entrant) : statut **Clôturé**, la réponse est liée au dossier. |

> 🎤 « À l'expédition, le courrier reçoit son numéro de départ. Le courrier d'origine se clôture automatiquement : la boucle est bouclée, sans relance manuelle. »

---

### Séquence 3 — Courrier sortant à l'initiative d'un service (2 min 30)

**Message clé :** *un circuit de validation clair, jusqu'à l'expédition.*
Circuit appliqué : **Visa du chef de service → Validation du directeur → Signature du DG → Expédition.**

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 3.1 | **Rodrigue** (technicien) | Menu **Registre sortant** → **« Rédiger un courrier »**. Correspondant **Transports Nkolbisson SARL**, objet « Planning d'intervention sur le groupe électrogène ». Choisir un modèle (ou déposer un document) → **« Aperçu de la lettre »** → **« Soumettre au circuit »**. |

> 🎤 « Un agent rédige un courrier. Il n'a pas à savoir à qui l'envoyer pour validation : le circuit s'en charge. »

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 3.2 | **Josiane** (chef maintenance) | Corbeille → ouvrir le courrier → **Viser** → paraphe. Montrer le cachet « LU ET APPROUVÉ » sur le brouillon. |
| 3.3 | **Hervé** (directeur technique) | Corbeille → ouvrir → **Valider**. |
| 3.4 | **Paul** (DG) | **Parapheur** → signer ce courrier. Sur le PDF signé : le visa de Josiane **et** la signature du DG. |
| 3.5 | **Carine** | **À expédier** → Mode d'envoi **Poste**, cocher **Accusé de réception** → **Expédier**. |
| 3.6 | **Carine** | **Registre sortant** : le courrier apparaît avec son numéro **DEP-…** et le statut « Expédié le … ». Montrer **Imprimer le registre** / **Exporter en CSV**. |

> 🎤 « Visa du chef de service, validation du directeur, signature, expédition : chaque étape est tracée et datée. Les visas restent visibles sur la version signée. Les registres de départ et d'arrivée sont tenus automatiquement. »

*Plan de coupe facultatif (20 s) — le rejet :* à l'étape 3.3, Hervé clique **Rejeter** et tente de valider sans motif (refusé), puis saisit un motif. Rodrigue reçoit le courrier en retour, dépose une nouvelle version et **resoumet** ; les deux versions restent consultables.

---

### Séquence 4 — Configuration : circuits et paramétrage (3 min 30)

**Message clé :** *vous adaptez l'outil à votre organisation, sans développeur.*

#### 4a. Identité de l'organisation (45 s)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 4.1 | **Admin POC** | Menu **Administration → Personnalisation** : nom, sigle, adresse, téléphone, e-mail, **logo**, **couleur principale**, **cachet numérique**, langue par défaut. |
| 4.2 | **Admin POC** | Changer la couleur principale → **Enregistrer** : toute l'interface change de couleur. Remettre la couleur du client. |
| 4.3 | **Admin POC** | Montrer le **délai d'escalade** (en jours) : au-delà, un retard remonte automatiquement au supérieur hiérarchique. |

> 🎤 « L'application prend l'identité de votre organisation : logo, couleurs, en-tête des courriers, cachet. Vous réglez aussi quand un retard doit remonter à la hiérarchie. »

#### 4b. Organigramme (45 s)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 4.4 | **Admin POC** | **Administration → Organigramme** : l'arbre des directions et services, avec leurs postes et titulaires. |
| 4.5 | **Admin POC** | Ouvrir un service → montrer l'ajout d'un **poste** et d'une **personne**, et un **intérim** (Grâce Eyenga assure l'intérim du chef RH). |

> 🎤 « L'organigramme est le cœur du système : les circuits désignent des postes, pas des personnes. Quand quelqu'un change de poste ou part en congé, on met à jour l'organigramme et les courriers suivent. »

#### 4c. Circuits de traitement (1 min 30)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 4.6 | **Admin POC** | **Administration → Circuits** : les onglets **Entrant standard**, **Facture fournisseur**, **Réclamation**, **Sortant standard**. Pour chacun : le sens et les types de courrier concernés. |
| 4.7 | **Admin POC** | Ouvrir **Facture fournisseur** : chaque étape a un **type** (imputation, traitement, visa, validation, signature, expédition), une **cible** (un poste précis ou un rôle : responsable de l'entité traitante, directeur, bureau d'ordre, rédacteur) et un **délai en jours**. |
| 4.8 | **Admin POC** | **« Ajouter une étape »** → type **Validation**, cible poste **Directeur général**, délai **2 jours** → **Enregistrer**. |
| 4.9 | **Admin POC** | Montrer la case **saut automatique** sur une étape de visa et la case **Circuit actif**. |

> 🎤 « Chaque type de courrier suit son circuit : qui intervient, dans quel ordre, avec quel délai. Vous pouvez ajouter une étape, changer un délai ou désigner un autre poste en quelques clics. La modification s'applique aux nouveaux courriers ; ceux déjà en circulation terminent leur parcours d'origine. »

> ⚠️ Après la prise, **supprimer l'étape ajoutée** (icône corbeille) et enregistrer, ou réinitialiser la démo, avant de retourner une séquence 1.

#### 4d. Modèles de lettres (30 s)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 4.10 | **Admin POC** | **Administration → Modèles de lettres** : ouvrir **« Réponse favorable »**. Montrer les **variables** entre accolades (`{{correspondant.nom}}`, `{{entrant.numero}}`…) remplies automatiquement à la rédaction (vu en séquence 2). |

> 🎤 « Vos modèles de lettres, en français ou en anglais, se remplissent automatiquement avec les informations du courrier. »

---

### Séquence 5 — Conclusion (0 min 30)

| # | 👤 Connecté | À l'écran |
|---|---|---|
| 5.1 | **Paul Mbarga** | Retour au **tableau de bord** : indicateurs à jour avec les courriers traités pendant la vidéo. Terminer sur le logo du client. |

> 🎤 « Un courrier enregistré en quelques secondes, un circuit qui dit à chacun quoi faire, une signature qui ne bloque plus, et une traçabilité complète. La gestion du courrier, enfin sous contrôle. »

---

## 3. Conseils de tournage et de montage

1. **Une séquence = une prise.** Réinitialiser la démo avant les séquences 1 à 3 si on refait tout ; la séquence 4 peut se tourner à tout moment.
2. **Ralentir la souris** et marquer une pause d'une seconde avant chaque clic important : c'est ce qui rend la vidéo lisible.
3. **Zoom au montage** sur les éléments clés : numéro ARR / DEP, cachet « LU ET APPROUVÉ », QR code, statut « Clôturé », saut automatique des étapes.
4. **Couper** les changements d'utilisateur et les temps de chargement ; les remplacer par le carton « Connecté en tant que… ».
5. Laisser apparaître les **messages de confirmation** (en bas de l'écran) 1 à 2 secondes avant de couper.
6. **Sous-titres** conseillés : beaucoup de vidéos client sont regardées sans le son.

---

## 4. ⚠️ Pièges à éviter

1. **Ne pas parler d'envoi réel d'e-mail** : l'expédition « par e-mail » enregistre l'adresse et l'envoi, mais aucun e-mail ne part depuis l'application dans cette version. Dire « le courrier est enregistré comme expédié par e-mail à… ».
2. **La signature électronique n'a pas de valeur légale** dans cette version (mention visible sur le PDF signé). Ne pas zoomer sur cette mention, et ne pas promettre une signature qualifiée sans la présenter comme une évolution.
3. **Cachet non configuré** : la case « Apposer le cachet de l'organisation » n'apparaît pas si l'étape de préparation 5 a été sautée.
4. **Horloge de démo** : ne pas toucher aux boutons « +1 h / +1 jour / +1 semaine » pendant le tournage, sinon les échéances affichées deviennent incohérentes. En cas d'erreur : « Revenir au présent ».
5. **Circuit modifié en séquence 4** : il s'applique aux courriers suivants. Remettre le circuit d'origine avant de retourner une séquence 1 à 3.
6. **Ordre des séquences** : la séquence 2 utilise le parapheur du DG, qui contient déjà d'autres courriers de démo. C'est voulu (signature en lot) ; ne pas les signer tous avant la séquence 3, pour garder du contenu à montrer.

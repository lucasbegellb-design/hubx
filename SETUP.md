# Mise en service de Hub XTIM — pas à pas

Ce guide s'adresse à une personne non développeuse. Tout se fait **depuis l'application** : aucune ligne de
commande n'est nécessaire. Compter une vingtaine de minutes (plus le temps d'obtenir, si besoin, l'accord d'un
administrateur Microsoft 365 pour le fichier d'Edwin).

Les valeurs secrètes (jetons, clés, mots de passe) ne doivent jamais être envoyées par e-mail : seulement collées
dans les écrans indiqués, et rangées dans le coffre-fort de mots de passe de l'entreprise.

Sommaire

1. [Installer l'application](#1-installer-lapplication)
2. [Installer le serveur avec l'assistant](#2-installer-le-serveur-avec-lassistant)
3. [Connecter le fichier Excel d'Edwin (application Azure)](#3-connecter-le-fichier-excel-dedwin-application-azure)
4. [Ajouter Edwin](#4-ajouter-edwin)
5. [Réglages recommandés](#5-réglages-recommandés)
6. [Publier les versions suivantes et les mises à jour automatiques](#6-publier-les-versions-suivantes-et-les-mises-à-jour-automatiques)
7. [Dépannage](#7-dépannage)
8. [Annexe : installation manuelle en ligne de commande](#8-annexe--installation-manuelle-en-ligne-de-commande)

---

## 1. Installer l'application

1. Récupérer l'installeur `Hub XTIM_x.y.z_x64-setup.exe` (GitHub → onglet **Releases**, ou artefact du workflow
   **Build Windows** dans l'onglet **Actions**).
2. Double-cliquer dessus. **Sans certificat de signature de code, Windows SmartScreen affiche « Windows a protégé votre
   ordinateur »** : cliquer **Informations complémentaires → Exécuter quand même**. C'est attendu ; un certificat
   (≈ 200 à 400 €/an) supprimerait cet avertissement.
3. L'installation se fait pour l'utilisateur courant, sans droits administrateur. Hub XTIM se lance ensuite et affiche
   l'**assistant de configuration**.

## 2. Installer le serveur avec l'assistant

Hub XTIM stocke les données partagées chez **Supabase** (base de données hébergée en Europe ; l'offre gratuite suffit
pour démarrer, l'offre Pro à ~25 $/mois ajoute des sauvegardes quotidiennes).

1. Dans l'assistant, choisir **Installer Hub XTIM**.
2. **Jeton d'accès Supabase** : créer un compte gratuit sur https://supabase.com, puis ouvrir **Account → Access Tokens**
   (lien direct dans l'assistant), **Generate new token**, nom « Hub XTIM ». Copier le jeton (`sbp_…`) et le coller.
   Il sert uniquement pendant l'installation et n'est jamais enregistré ; tu peux le supprimer ensuite sur supabase.com.
3. **Projet** : choisir **Créer un nouveau projet** (nom `hub-xtim`, région **Paris**). Le mot de passe de la base est
   généré : le copier dans le coffre-fort (il ne sert qu'à un informaticien). La création prend 1 à 3 minutes.
   Un projet existant peut aussi être choisi : l'installation est sans risque pour un projet vide ou déjà équipé de Hub XTIM.
4. **Compte administrateur** : ton nom, ton e-mail et un mot de passe (10 caractères minimum).
5. **Clés des services** (facultatif, modifiables plus tard dans **Paramètres › Clés et connexions**) :
   - **Intelligence artificielle** : choisir le fournisseur (voir [§ 2.1](#21-choisir-le-fournisseur-dia)) et coller sa
     clé API. Par défaut **Mistral AI**, gratuit. Sans clé, tout fonctionne sauf l'analyse des documents, la
     structuration des process et la synthèse rédigée des rapports.
   - **Fichier Excel d'Edwin** : voir [§ 3](#3-connecter-le-fichier-excel-dedwin-application-azure). Sans ces identifiants,
     le suivi Chine fonctionne en mode démo sur un fichier d'exemple.
6. **Installer** : l'assistant crée la base de données, installe les fonctions serveur, ferme les inscriptions
   publiques, active les tâches automatiques (synchro Chine toutes les 15 min, rapports du vendredi et de fin de mois),
   crée ton compte et enregistre les clés. En cas d'erreur, **Réessayer** reprend là où c'était arrêté.
7. **Ouvrir Hub XTIM** : tu es connecté. Le code d'invitation affiché sert à Edwin (§ 4).

Les clés sont stockées **chiffrées sur le serveur** (coffre Supabase) et ne sont jamais relisibles depuis l'application :
on peut seulement les remplacer ou les tester.

### 2.1 Choisir le fournisseur d'IA

L'IA sert à analyser les documents, structurer les process et rédiger la synthèse des rapports. Les appels partent du
serveur ; le fournisseur, le modèle et la clé se changent à tout moment dans **Paramètres › Clés et connexions**
(bouton **Tester** pour vérifier).

| Fournisseur                   | Coût                                                                         | Remarques                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Mistral AI** (recommandé)   | Gratuit avec l'offre _Experiment_ (sans carte bancaire), limité en débit     | Entreprise française, serveurs en Europe. Lit aussi les images et les PDF scannés.           |
| **DeepSeek**                  | Crédit d'essai à l'inscription, puis quelques centimes par million de jetons | Texte uniquement (pas d'images ni de PDF scannés). Serveurs en Chine.                        |
| **Qwen** (Alibaba Cloud)      | Quota gratuit à l'ouverture (région internationale), puis bon marché         | Texte uniquement avec les modèles proposés.                                                  |
| **Autre** (compatible OpenAI) | Selon le service                                                             | OpenRouter (modèles `:free`), Groq, Gemini… : saisir l'adresse de l'API et le nom du modèle. |

**Créer une clé Mistral gratuite** : compte sur https://console.mistral.ai → choisir l'offre **Experiment** (vérification
par SMS) → **API Keys → Create new key** → coller la clé dans Hub XTIM. Avec l'offre gratuite, Mistral peut utiliser les
échanges pour entraîner ses modèles ; pour des documents confidentiels, passer à l'offre payante (quelques euros par mois
pour l'usage de Hub XTIM) qui l'exclut.

Exemples d'adresses pour « Autre » : OpenRouter `https://openrouter.ai/api/v1`, Groq `https://api.groq.com/openai/v1`,
Gemini `https://generativelanguage.googleapis.com/v1beta/openai`.

## 3. Connecter le fichier Excel d'Edwin (application Azure)

Le logiciel lit le fichier de suivi Chine **en lecture seule** via Microsoft Graph ; il ne le modifie jamais.
Cette étape demande un compte **administrateur Microsoft 365**.

1. Aller sur https://entra.microsoft.com → **Applications → Inscriptions d'applications → Nouvelle inscription**.
   Nom : `Hub XTIM – lecture Suivi Chine` · Types de comptes : _Comptes de cet annuaire uniquement_ · pas d'URI de
   redirection → **S'inscrire**.
2. Sur la page de l'application, noter **ID d'application (client)** et **ID de l'annuaire (locataire)**.
3. **Autorisations d'API → Ajouter une autorisation → Microsoft Graph → Autorisations d'application** → cocher
   **Files.Read.All** → Ajouter, puis **Accorder un consentement d'administrateur pour XTIM** (coche verte).
4. **Certificats et secrets → Nouveau secret client** : description `hub-xtim`, expiration **24 mois**. Copier
   immédiatement la **Valeur**. ⚠️ Noter la date d'expiration dans l'agenda : il faudra recréer un secret avant (PASSATION.md).
5. Dans Hub XTIM : **Paramètres › Clés et connexions → Fichier Excel d'Edwin** : coller l'ID de l'annuaire, l'ID
   d'application et le secret → **Enregistrer** (un test de connexion à Microsoft est fait aussitôt).
6. Dans OneDrive, Edwin ouvre le fichier → **Partager → Copier le lien** (un lien « Personnes de XTIM » suffit).
7. **Paramètres › Suivi Chine** : coller le lien → **Enregistrer** → **Tester la connexion** (affiche le nom du fichier)
   → **Actualiser maintenant**.
8. Configurer le **mapping** dans le même écran : choisir l'onglet des paiements, **Détecter**, corriger au besoin, puis
   **Ajouter un onglet** pour les livraisons → **Enregistrer le mapping**. Les montants et alertes apparaissent.

## 4. Ajouter Edwin

1. **Paramètres › Comptes et rôles → Ajouter un compte** : nom et e-mail d'Edwin, rôle _Membre_. Noter le mot de passe
   provisoire proposé.
2. **Paramètres › Clés et connexions → Inviter un collègue** : copier le **code d'invitation** (il commence par `HUBX1.`).
3. Envoyer à Edwin l'installeur, le code d'invitation et (de vive voix) son mot de passe provisoire.
4. Sur son PC, Edwin installe l'application, choisit **Rejoindre mon équipe**, colle le code, puis se connecte.
   Il changera son mot de passe dans **Paramètres › Mon compte**.

## 5. Réglages recommandés

- **Paramètres › Apparence et bureau → Démarrer avec Windows** : l'app démarre dans la zone de notification, prête
  pour les rappels.
- Raccourci global de capture rapide : `Ctrl + Maj + Espace` (modifiable au même endroit).
- **Paramètres › Mises à jour et export → Exporter toutes les données** : à faire régulièrement (sauvegarde).

## 6. Publier les versions suivantes et les mises à jour automatiques

Les nouvelles versions sont construites par GitHub (onglet **Actions**). Pour que les postes se mettent à jour seuls :

### 6.1 Clé de signature des mises à jour (une fois)

Sur un PC avec Node.js (https://nodejs.org) et le dépôt cloné :

```powershell
npx tauri signer generate -w "$HOME\.tauri\hub-xtim.key"
```

- Choisir un mot de passe et le noter dans le coffre-fort.
- Dans `src-tauri/tauri.conf.json`, remplacer `REMPLACER_PAR_LA_CLE_PUBLIQUE_DE_MISE_A_JOUR` par le contenu de
  `hub-xtim.key.pub`, puis committer.
- ⚠️ Sauvegarder `hub-xtim.key` (clé privée) dans le coffre-fort : sans elle, plus de mises à jour automatiques possibles.
- GitHub → dépôt → **Settings → Secrets and variables → Actions** : créer `TAURI_SIGNING_PRIVATE_KEY` (contenu de
  `hub-xtim.key`) et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Facultatif : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` intègrent l'adresse du serveur à l'installeur (l'assistant
  ne demande alors plus que l'identifiant et le mot de passe). Sans eux, le code d'invitation fait la même chose.

### 6.2 Visibilité du dépôt

Les applications téléchargent les mises à jour depuis `https://github.com/lucasbegellb-design/hubx/releases/latest/download/latest.json`.
Les fichiers d'une release d'un **dépôt privé** ne sont pas téléchargeables sans authentification : rendre le dépôt public
(il ne contient aucun secret), ou publier les releases dans un second dépôt public et modifier `endpoints` dans
`src-tauri/tauri.conf.json`.

### 6.3 Publier une version

1. Incrémenter la version dans `package.json` (ex. `0.2.0`), committer sur `main`.
2. Créer le tag correspondant et le pousser : `git tag v0.2.0 && git push origin v0.2.0`
   (ou GitHub → **Releases → Draft a new release → Choose a tag : v0.2.0**).
3. Le workflow **Release** construit Windows et macOS (≈ 15 min) et publie la release. Les postes proposent
   « Nouvelle version disponible → Installer » au démarrage : **Edwin n'a rien à faire**.
4. Si la nouvelle version apporte des changements au serveur, l'application de l'administrateur affiche un bandeau
   **Mettre à jour le serveur** : il suffit de cliquer et de coller un jeton d'accès Supabase (§ 2.2).

## 7. Dépannage

| Symptôme                                         | Cause probable                                                                         | Que faire                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| « Jeton d'accès refusé » dans l'assistant        | Jeton mal copié ou supprimé                                                            | En générer un nouveau (Account → Access Tokens)                         |
| « Serveur injoignable » / bandeau hors connexion | Internet coupé ou projet Supabase en pause (offre gratuite après 7 jours d'inactivité) | Vérifier la connexion ; supabase.com → projet → _Restore project_       |
| « Ce compte n'est pas membre du Hub »            | Compte non ajouté par l'administrateur                                                 | Paramètres › Comptes et rôles                                           |
| Bandeau « Configuration à terminer »             | Clé IA ou identifiants Azure absents                                                   | Paramètres › Clés et connexions                                         |
| Bandeau « Mettre à jour le serveur »             | Nouvelle version de l'app                                                              | Cliquer, coller un jeton d'accès Supabase                               |
| Suivi Chine : « Accès refusé par Microsoft »     | Consentement administrateur manquant                                                   | § 3.3                                                                   |
| Suivi Chine : « Connexion Microsoft refusée »    | Secret Azure expiré ou erroné                                                          | Nouveau secret (§ 3.4) puis Paramètres › Clés et connexions             |
| Suivi Chine : « Fichier introuvable »            | Lien de partage supprimé ou fichier déplacé                                            | Nouveau lien dans Paramètres › Suivi Chine                              |
| Suivi Chine : « La colonne … est introuvable »   | Edwin a renommé une colonne                                                            | Mettre à jour le mapping                                                |
| Documents « Non analysé »                        | Clé IA absente, crédit épuisé, format non pris en charge                               | Détail dans le panneau du document ; « Tester » dans Clés et connexions |
| Tâches automatiques « À réparer »                | Adresse du serveur absente du coffre                                                   | Bouton **Réparer** dans Clés et connexions                              |
| « Mises à jour non configurées »                 | Clé publique à remplacer dans `tauri.conf.json`                                        | § 6.1 puis nouvelle version                                             |
| Raccourci global inopérant                       | Combinaison prise par une autre application                                            | Paramètres › Apparence et bureau                                        |
| Changer de serveur sur un poste                  | —                                                                                      | Paramètres › Clés et connexions → **Changer de serveur**                |

## 8. Annexe : installation manuelle en ligne de commande

Alternative à l'assistant, pour un informaticien (Node.js 22 et le dépôt cloné, `npm ci`) :

```powershell
npx supabase login
npx supabase link --project-ref VOTRE_REF
npx supabase db push                      # migrations (schéma, sécurité, référentiels, planification, clés)
npx supabase functions deploy             # les six Edge Functions (verify_jwt = false, voir config.toml)
```

Puis, dans le tableau de bord Supabase :

- **Authentication → Sign In / Providers** : désactiver « Allow new users to sign up ».
- **SQL Editor** : `select public.enregistrer_secret('url', 'https://VOTRE-REF.supabase.co');` (tâches automatiques).
- Clés des services : soit dans l'app (Paramètres › Clés et connexions), soit en secrets des fonctions
  (`npx supabase secrets set IA_API_KEY=… AZURE_TENANT_ID=… AZURE_CLIENT_ID=… AZURE_CLIENT_SECRET=…`,
  prioritaires sur ceux saisis dans l'app ; le fournisseur et le modèle se choisissent toujours dans l'app).
- Premier administrateur : **Authentication → Users → Add user** (Auto Confirm), puis se connecter dans l'app et cliquer
  **Devenir administrateur**.
- `supabase/seed.sql` et `supabase/seeds/` sont des données de **démonstration locale** : ne pas les exécuter en production.

Construire l'installeur soi-même : Rust (https://rustup.rs) puis `npm run tauri build` → `src-tauri\target\release\bundle\nsis\`.

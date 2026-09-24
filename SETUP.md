# Mise en service de Hub XTIM — pas à pas

Ce guide s'adresse à une personne non développeuse. Compter environ deux heures la première fois.
Chaque étape indique **où cliquer** et **quoi copier**. Les valeurs secrètes ne doivent jamais être
envoyées par e-mail ni collées dans le code : seulement dans les écrans indiqués.

Sommaire

1. [Ce qu'il faut avant de commencer](#1-ce-quil-faut-avant-de-commencer)
2. [Créer le projet Supabase](#2-créer-le-projet-supabase)
3. [Installer les outils sur le PC](#3-installer-les-outils-sur-le-pc)
4. [Créer la base de données (migrations)](#4-créer-la-base-de-données-migrations)
5. [Déployer les fonctions serveur et leurs secrets](#5-déployer-les-fonctions-serveur-et-leurs-secrets)
6. [Activer les tâches planifiées (pg_cron)](#6-activer-les-tâches-planifiées-pg_cron)
7. [Connecter le fichier Excel d'Edwin (application Azure)](#7-connecter-le-fichier-excel-dedwin-application-azure)
8. [Créer les comptes de Lucas et d'Edwin](#8-créer-les-comptes-de-lucas-et-dedwin)
9. [Préparer GitHub (secrets et clé de mise à jour)](#9-préparer-github-secrets-et-clé-de-mise-à-jour)
10. [Publier la première version et l'installer](#10-publier-la-première-version-et-linstaller)
11. [Dépannage](#11-dépannage)

---

## 1. Ce qu'il faut avant de commencer

| Compte                                | Pourquoi                                                                    | Coût indicatif                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **GitHub** (le dépôt `hubx`)          | Code source, construction automatique des installeurs, mises à jour         | Gratuit                                                                                      |
| **Supabase** (supabase.com)           | Base de données, connexion, fichiers, fonctions serveur                     | Gratuit pour démarrer ; offre Pro (~25 $/mois) recommandée pour les sauvegardes quotidiennes |
| **Anthropic** (console.anthropic.com) | IA : analyse de documents, structuration des process, synthèse des rapports | À l'usage, quelques euros par mois pour deux personnes                                       |
| **Microsoft 365 administrateur**      | Autoriser la lecture du fichier Excel d'Edwin                               | Inclus dans l'abonnement                                                                     |

Sans clé Anthropic, tout fonctionne sauf les fonctions IA (les rapports restent complets, sans synthèse rédigée).
Sans application Azure, le Suivi Chine tourne en **mode démo** sur un fichier d'exemple.

## 2. Créer le projet Supabase

1. Sur https://supabase.com/dashboard, **New project**.
   - Nom : `hub-xtim` · Région : **Europe (Paris ou Frankfurt)** · Mot de passe de base : générer, puis **le noter dans le coffre-fort de mots de passe**.
2. Une fois le projet prêt, ouvrir **Project Settings → API Keys** et noter :
   - l'**URL du projet** (`https://xxxxxxxx.supabase.co`) ;
   - la clé **publishable** (`sb_publishable_…`) ou, à défaut, la clé **anon** (onglet « Legacy »). C'est la seule clé qui ira dans l'application.
   - La clé **secret / service_role** ne doit jamais être copiée ailleurs que dans Supabase.
3. Noter aussi l'**identifiant du projet** (Project Settings → General → Reference ID).
4. **Authentication → Sign In / Providers** :
   - « Allow new users to sign up » : **désactivé** (seul l'administrateur crée les comptes) ;
   - fournisseur **Email** : activé ; « Confirm email » : peut rester activé (les comptes créés depuis l'app sont déjà confirmés).

## 3. Installer les outils sur le PC

Sur le PC de Lucas (Windows) :

1. Installer **Node.js 22 LTS** : https://nodejs.org (bouton « LTS », installer avec les options par défaut).
2. Installer **Git** : https://git-scm.com/download/win.
3. Ouvrir **PowerShell** et récupérer le dépôt :
   ```powershell
   git clone https://github.com/lucasbegellb-design/hubx.git
   cd hubx
   npm ci
   ```

## 4. Créer la base de données (migrations)

Toujours dans PowerShell, dans le dossier `hubx` :

```powershell
npx supabase login                          # ouvre le navigateur pour autoriser la CLI
npx supabase link --project-ref VOTRE_REF   # REF = Reference ID noté à l'étape 2 ; demande le mot de passe de base
npx supabase db push                        # crée tables, sécurité, domaines, projet Swift, planifications
```

Vérification : dans le tableau de bord Supabase, **Table Editor** doit montrer `taches`, `process`, `documents`…
et la table `domaines` doit contenir Commercial, Admin, Compta, RH, Produit, Production.

> `supabase/seed.sql` contient des **données de démonstration** pour le développement local : ne pas l'exécuter en production.

## 5. Déployer les fonctions serveur et leurs secrets

1. Générer un secret aléatoire pour les tâches planifiées (à garder pour l'étape 6) :
   ```powershell
   [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```
2. Créer une clé API sur https://console.anthropic.com → **API Keys** → _Create key_ (nom : `hub-xtim`).
3. Enregistrer les secrets côté Supabase (jamais dans l'application) :
   ```powershell
   npx supabase secrets set CRON_SECRET=LE_SECRET_GENERE ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Déployer les cinq fonctions :
   ```powershell
   npx supabase functions deploy
   ```
   Vérification : **Edge Functions** dans le tableau de bord liste `sync-chine`, `analyze-document`,
   `structure-process`, `generate-report`, `manage-members`.

Le modèle IA se change ensuite dans l'application (Paramètres › IA et rapports ; défaut `claude-sonnet-5`).

## 6. Activer les tâches planifiées (pg_cron)

Les planifications (synchro Chine toutes les 15 min, rapport hebdo le vendredi 17 h, mensuel le dernier
jour ouvré 17 h) sont créées par les migrations. Il reste à leur donner l'adresse du projet et le secret :

1. Tableau de bord Supabase → **SQL Editor** → _New query_, coller en remplaçant les deux valeurs :
   ```sql
   select vault.create_secret('https://VOTRE-PROJET.supabase.co', 'hubx_url');
   select vault.create_secret('LE_SECRET_GENERE_A_L_ETAPE_5', 'hubx_cron_secret');
   ```
2. **Run**. Vérifier ensuite :
   ```sql
   select jobname, schedule from cron.job;                        -- 2 lignes : hubx-sync-chine, hubx-rapports
   select status, return_message from cron.job_run_details order by start_time desc limit 5;
   ```
   Pour changer un secret plus tard : `select vault.update_secret((select id from vault.secrets where name = 'hubx_url'), 'nouvelle valeur');`

## 7. Connecter le fichier Excel d'Edwin (application Azure)

Le logiciel lit le fichier en **lecture seule** via Microsoft Graph. Il ne le modifie jamais.
Cette étape demande un compte **administrateur Microsoft 365**.

1. Aller sur https://entra.microsoft.com → **Applications → Inscriptions d'applications → Nouvelle inscription**.
   - Nom : `Hub XTIM – lecture Suivi Chine` · Types de comptes : _Comptes de cet annuaire uniquement_ · pas d'URI de redirection → **S'inscrire**.
2. Sur la page de l'application, noter **ID d'application (client)** et **ID de l'annuaire (locataire)**.
3. **Autorisations d'API → Ajouter une autorisation → Microsoft Graph → Autorisations d'application** →
   cocher **Files.Read.All** → Ajouter. Puis cliquer **Accorder un consentement d'administrateur pour XTIM** (coche verte).
4. **Certificats et secrets → Nouveau secret client** : description `hub-xtim`, expiration **24 mois**.
   Copier immédiatement la **Valeur** (elle ne sera plus affichée). ⚠️ Noter la date d'expiration dans l'agenda :
   il faudra recréer un secret avant cette date (voir PASSATION.md).
5. Enregistrer les trois valeurs dans Supabase :
   ```powershell
   npx supabase secrets set AZURE_TENANT_ID=... AZURE_CLIENT_ID=... AZURE_CLIENT_SECRET=...
   ```
6. Dans OneDrive, Edwin ouvre le fichier de suivi → **Partager → Copier le lien** (un lien « Personnes de XTIM » suffit).
7. Dans l'application : **Paramètres › Suivi Chine** → coller le lien → **Enregistrer** → **Tester la connexion**
   (doit afficher le nom du fichier) → **Actualiser maintenant**.
8. Toujours dans cet écran, configurer le **mapping** : choisir l'onglet des paiements, cliquer **Détecter**, corriger
   au besoin (fournisseur, n° PO, montant, devise, échéance, date de paiement, statut), puis **Ajouter un onglet** pour
   celui des livraisons (livraison prévue, livraison réelle). **Enregistrer le mapping** : les montants et alertes apparaissent.

## 8. Créer les comptes de Lucas et d'Edwin

1. Tableau de bord Supabase → **Authentication → Users → Add user → Create new user** :
   e-mail de Lucas, mot de passe, cocher **Auto Confirm User**.
2. Ouvrir l'application (étape 10, ou `npm run tauri dev`), se connecter avec ce compte :
   l'écran « Accès non autorisé » propose **Devenir administrateur** (uniquement tant qu'aucun administrateur n'existe).
3. Dans **Paramètres › Comptes et rôles → Ajouter un compte** : nom et e-mail d'Edwin, rôle _Membre_,
   mot de passe provisoire (à transmettre de vive voix ; il le changera dans Paramètres › Mon compte).

## 9. Préparer GitHub (secrets et clé de mise à jour)

### 9.1 Clé de signature des mises à jour

Les mises à jour automatiques sont signées : l'application refuse toute version qui ne l'est pas avec **votre** clé.

```powershell
npx tauri signer generate -w "$HOME\.tauri\hub-xtim.key"
```

- Choisir un mot de passe et le noter dans le coffre-fort.
- Ouvrir `src-tauri/tauri.conf.json`, remplacer `REMPLACER_PAR_LA_CLE_PUBLIQUE_DE_MISE_A_JOUR` par le contenu du fichier
  `hub-xtim.key.pub`, puis committer ce changement.
- ⚠️ **Sauvegarder `hub-xtim.key` (clé privée) dans le coffre-fort** : sans elle, impossible de publier des mises à jour
  pour les postes déjà installés (il faudrait réinstaller à la main).

### 9.2 Secrets du dépôt

GitHub → dépôt `hubx` → **Settings → Secrets and variables → Actions → New repository secret** :

| Nom                                  | Valeur                                    |
| ------------------------------------ | ----------------------------------------- |
| `VITE_SUPABASE_URL`                  | URL du projet (étape 2)                   |
| `VITE_SUPABASE_ANON_KEY`             | clé publishable / anon (étape 2)          |
| `TAURI_SIGNING_PRIVATE_KEY`          | contenu complet du fichier `hub-xtim.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | mot de passe choisi en 9.1                |

### 9.3 Visibilité du dépôt et mises à jour

L'application télécharge les mises à jour depuis `https://github.com/lucasbegellb-design/hubx/releases/latest/download/latest.json`.
**Les fichiers d'une release d'un dépôt privé ne sont pas téléchargeables sans authentification.** Deux options :

- rendre le dépôt **public** (le code ne contient aucun secret : les clés sont dans Supabase et GitHub Secrets) ;
- ou garder le code privé et publier les releases dans un **second dépôt public** (ex. `hubx-releases`) : modifier
  `endpoints` dans `src-tauri/tauri.conf.json` et le paramètre `owner/repo` de l'action dans `.github/workflows/release.yml`.

## 10. Publier la première version et l'installer

1. Choisir un numéro de version (ex. `0.1.0`) : il doit être identique dans `package.json` et dans le tag.
   ```powershell
   npm version 0.1.0 --no-git-tag-version   # inutile si package.json est déjà en 0.1.0
   git commit -am "Version 0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```
2. GitHub → **Actions → Release** : attendre la fin (≈ 15 min). La release **Hub XTIM v0.1.0** contient
   `Hub XTIM_0.1.0_x64-setup.exe` (Windows), un `.msi`, un `.dmg` (macOS) et `latest.json`.
3. Sur chaque PC : télécharger le `.exe` et l'exécuter.
   **Sans certificat de signature de code, Windows SmartScreen affiche « Windows a protégé votre ordinateur »** :
   cliquer **Informations complémentaires → Exécuter quand même**. C'est attendu ; un certificat de signature
   (≈ 200 à 400 €/an) supprimerait cet avertissement.
4. Premier lancement : se connecter. Dans **Paramètres › Apparence et bureau**, activer **Démarrer avec Windows**.
5. Versions suivantes : incrémenter la version, taguer, pousser. Les applications installées proposent
   « Nouvelle version disponible → Installer » au démarrage : **Edwin n'a rien à faire**.

Construire l'installeur localement (sans publier) : `npm run tauri build` → `src-tauri\target\release\bundle\nsis\`.
Il faut alors un fichier `.env` avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, et Rust (https://rustup.rs).
Sans ces variables, l'application demande l'adresse du serveur au premier lancement.

## 11. Dépannage

| Symptôme                                         | Cause probable                                                                         | Que faire                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| « Serveur injoignable » / bandeau hors connexion | Internet coupé ou projet Supabase en pause (offre gratuite après 7 jours d'inactivité) | Vérifier la connexion ; tableau de bord Supabase → _Restore project_    |
| « Ce compte n'est pas membre du Hub »            | Compte créé dans Supabase mais pas ajouté aux membres                                  | Paramètres › Comptes et rôles (admin)                                   |
| Suivi Chine : « Accès refusé par Microsoft »     | Consentement administrateur manquant ou retiré                                         | Étape 7.3                                                               |
| Suivi Chine : « Connexion Microsoft refusée »    | Secret Azure expiré ou erroné                                                          | Recréer un secret (7.4), `supabase secrets set AZURE_CLIENT_SECRET=...` |
| Suivi Chine : « Fichier introuvable »            | Lien de partage supprimé ou fichier déplacé                                            | Nouveau lien dans Paramètres › Suivi Chine                              |
| Suivi Chine : « La colonne … est introuvable »   | Edwin a renommé une colonne                                                            | Mettre à jour le mapping                                                |
| Documents « Non analysé »                        | Clé Anthropic absente/épuisée, format non pris en charge                               | Message détaillé dans le panneau du document ; « Relancer l'analyse »   |
| Pas de rapport le vendredi                       | Secrets Vault absents (étape 6) ou rapports automatiques désactivés                    | `select * from cron.job_run_details order by start_time desc limit 10;` |
| « Mises à jour non configurées »                 | Clé publique toujours à remplacer dans `tauri.conf.json`                               | Étape 9.1, puis nouvelle release                                        |
| Raccourci global inopérant                       | Combinaison déjà prise par une autre application                                       | Paramètres › Apparence et bureau                                        |

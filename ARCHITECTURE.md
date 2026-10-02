# Architecture de Hub XTIM

## Vue d'ensemble

```
┌──────────────────────────── Poste Windows (Lucas / Edwin) ────────────────────────────┐
│  Hôte Tauri 2 (Rust, src-tauri/)                                                       │
│   • zone de notification, fermeture = réduction, instance unique                       │
│   • fenêtre de capture (raccourci global), démarrage auto, taille/position mémorisées  │
│   • notifications natives, boîtes de dialogue, écriture de fichiers, mises à jour      │
│  ┌───────────────────────── WebView (React 18, src/) ──────────────────────────────┐  │
│  │ Routes lazy : Aujourd'hui · Tâches · Post-its · Process · Suivi Chine ·          │  │
│  │               Documents · Rapports · Paramètres · /capture                       │  │
│  │ TanStack Query (cache) ← invalidé par Supabase Realtime                          │  │
│  │ Zustand (état UI : thème, palette, brouillons persistés)                         │  │
│  │ @shared/* = logique métier pure (échéances, saisie, Chine, rapports, dates)      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────┬────────────────────────────────────────────────────────────────────────┘
               │ HTTPS / WSS (clé publique « anon » + JWT de l'utilisateur)
┌──────────────▼──────────────────────────── Supabase ───────────────────────────────────┐
│ Auth (e-mail / mot de passe)   Postgres + RLS   Realtime   Storage (documents,         │
│                                                            sauvegardes)                │
│ Edge Functions (Deno) : sync-chine · analyze-document · structure-process ·            │
│                         generate-report · manage-members · configuration · sauvegarde │
│                         calendrier (GET, flux iCal par jeton)                          │
│ pg_cron + pg_net ─► sync-chine (*/15 min), generate-report (vendredi / fin de mois),   │
│                     sauvegarde (dimanche)                                              │
└──────┬─────────────────────────────────────────┬───────────────────────────────────────┘
       │ client credentials (Files.Read.All)     │ clé API (secret serveur)
┌──────▼──────────────┐                 ┌────────▼──────────────┐
│ Microsoft Graph     │                 │ API d'IA au choix     │
│ OneDrive d'Edwin    │                 │ Mistral (défaut),     │
└─────────────────────┘                 │ DeepSeek, Qwen, autre │
                                        └───────────────────────┘
```

## Arborescence

| Chemin                              | Contenu                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                          | Coquille : barre latérale, bandeau hors connexion, routeur, services d'arrière-plan (rappels, notifications, raccourci global, mises à jour). |
| `src/features/<module>/`            | Une page, ses composants et `api.ts` (requêtes et mutations TanStack Query).                                                                  |
| `src/features/pdf/`                 | Exports PDF (@react-pdf/renderer, chargé à la demande).                                                                                       |
| `src/lib/`                          | Client Supabase, types générés, realtime, détection réseau, pont Tauri, appels de fonctions, formatage.                                       |
| `src/components/ui/`                | Composants shadcn/ui (Radix). `src/components/common.tsx` : en-têtes, états vides, sections.                                                  |
| `supabase/functions/_shared/logic/` | **Logique métier pure** partagée par le client (alias `@shared`) et les fonctions : aucune dépendance, testée par Vitest.                     |
| `supabase/functions/_shared/`       | Socle serveur : CORS/erreurs (`http.ts`), vérification de l'appelant (`auth.ts`), IA (`ia.ts`), extraction de texte (`fichiers.ts`).          |
| `supabase/migrations/`              | Schéma, RLS, triggers, RPC, planification.                                                                                                    |
| `src-tauri/`                        | Hôte Rust, configuration, droits (capabilities), icônes.                                                                                      |
| `tests/`                            | Tests Vitest. `fixtures/` : fichier Excel d'exemple. `scripts/` : outils de développement.                                                    |

## Données

Toutes les tables ont `id uuid`, `created_at`, `updated_at` (trigger) et la RLS activée.

| Table                            | Rôle                                      | Particularités                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `membres`                        | Qui a accès (admin / membre)              | `derniere_ouverture_at` alimente « depuis ta dernière visite »                                                                                                                                                                                                                                                      |
| `domaines`, `projets`            | Référentiels                              | Domaines : admin ; projet archivé = hors vues par défaut                                                                                                                                                                                                                                                            |
| `taches`                         | Tâches                                    | `done_at` géré par trigger ; suppression douce (`deleted_at`) ; `recurrence` (jsonb) + `serie_id` / `suite_de` : à la clôture, le trigger `taches_occurrence_suivante` crée la suivante (`prochaine_echeance`, même calcul que `_shared/logic/recurrence.ts`) avec les étapes décochées ; rouvrir aussitôt l'annule |
| `sous_taches`                    | Étapes (checklist) d'une tâche            | Membres ; supprimées avec la tâche                                                                                                                                                                                                                                                                                  |
| `calendriers`                    | Lien d'abonnement iCal par membre         | Seul le SHA-256 du jeton est stocké (RPC `generer_jeton_calendrier`) ; ni temps réel ni export                                                                                                                                                                                                                      |
| `commentaires`                   | Fil de discussion d'une tâche             | Écriture par l'auteur seulement ; `mentions` (uuid[]) → notification realtime + « Pour toi »                                                                                                                                                                                                                        |
| `postits`                        | Post-its et rappels                       | Privés par défaut (`partage`), `rappel_envoye` remis à faux si le rappel change                                                                                                                                                                                                                                     |
| `process`, `process_versions`    | Process et historique                     | Version créée par trigger à chaque changement de contenu ; recherche plein texte française                                                                                                                                                                                                                          |
| `documents` + bucket `documents` | Bibliothèque                              | Analyse IA : `analyse_statut`, `resume`, `infos_cles`, `taches_suggerees`                                                                                                                                                                                                                                           |
| `chine_source`                   | Lien de partage, état de synchro, mapping | Ligne unique, modifiable par l'admin                                                                                                                                                                                                                                                                                |
| `chine_snapshots`                | Versions du fichier                       | Enregistré si le hash change, au moins une fois par jour                                                                                                                                                                                                                                                            |
| `rapports`                       | Rapports générés                          | `donnees` (chiffres), `synthese` (IA), `contenu_md` ; unicité des rapports automatiques par période                                                                                                                                                                                                                 |
| `parametres`                     | Modèle IA, rapports auto                  | Ligne unique, admin                                                                                                                                                                                                                                                                                                 |
| `journal_activite`               | Historique des actions                    | Alimenté par triggers (tâches, process, documents, post-its partagés) ; base du reporting                                                                                                                                                                                                                           |

### Sécurité (RLS)

- `est_membre()` / `est_admin()` (fonctions `security definer`) conditionnent tous les accès ; `anon` n'a aucun droit.
- Post-its non partagés visibles uniquement par leur propriétaire.
- `parametres`, `chine_source`, `domaines`, rôles des membres : écriture admin seulement.
- `journal_activite`, `chine_snapshots`, `rapports` : aucune écriture client (triggers ou fonctions en service role).
- Les Edge Functions sont déployées avec `verify_jwt = false` et **vérifient elles-mêmes** le JWT puis l'appartenance
  à `membres` (`_shared/auth.ts`) ; pg_cron s'authentifie avec l'en-tête `x-cron-secret`.
- Le client ne contient que l'URL et la clé publique. Clé serveur, secrets Azure et clé d'IA : secrets des fonctions ou Vault.

## Flux principaux

### Calendrier

- Page `/calendrier` : `_shared/logic/calendrier.ts` transforme tâches, rappels, lignes Chine et rapports automatiques
  en événements par jour ; glisser une tâche sur un jour appelle `useMajTache`.
- Flux iCal (`calendrier`, GET `?jeton=`) : `servir(…, { methodes: ["GET"] })`, jeton de 48 caractères hex comparé à
  son hachage, événements de l'utilisateur (`_shared/logic/ical.ts` : RFC 5545, pliage à 75 octets, journées entières,
  rappels horodatés en UTC avec alarme).

### Sauvegardes et mises à jour

- `sauvegarde` (cron du dimanche ou bouton admin) : JSON de toutes les tables (`TABLES_EXPORT`, `_shared/logic/export.ts`,
  partagé avec l'export complet de l'app) zippé dans le bucket privé `sauvegardes` (lecture admin, 8 conservées).
- Mises à jour de l'app : release signée (`release.yml`, `tagName: v__VERSION__`, `latest.json`), clé publique dans
  `tauri.conf.json`, vérification au démarrage (`src/lib/misesAJour.ts`).

### Temps réel

`src/lib/realtime.ts` s'abonne aux changements des tables et invalide les requêtes dont la clé commence par le nom
de la table (`["taches", …]`). Une action d'Edwin apparaît chez Lucas sans recharger. À la reconnexion, tout est resynchronisé.

### Hors connexion

`src/lib/online.ts` combine les événements du navigateur et les échecs réseau des requêtes, puis sonde
`/auth/v1/health` jusqu'au retour. Hors ligne : bandeau, boutons d'écriture désactivés, mutations refusées
proprement (`verifierEcriture`). Les saisies en cours (barre rapide, notes, process, post-it en création) sont des
brouillons persistés en local et ne sont jamais perdus.

### Rappels

Toutes les 30 s, `ServicesArrierePlan` cherche les post-its de l'utilisateur dont le rappel est échu et non envoyé,
les marque envoyés (mise à jour conditionnelle, pas de double envoi) puis affiche une notification Windows.
Au démarrage, les rappels manqués pendant que l'app était fermée sont signalés comme tels.

### Suivi Chine

```
pg_cron (15 min) ou bouton « Actualiser »
  → sync-chine : Graph /shares/{lien encodé}/driveItem → téléchargement .xlsx   (mode démo : fichier embarqué)
  → SheetJS → normaliserClasseur (en-têtes détectés) → hash SHA-256
  → snapshot si changement ou premier du jour ; chine_source.last_sync_at / last_error
Client : onglets bruts (aucune config) ; mapping → appliquerMapping → KPI, alertes ; diffSnapshots pour l'historique.
```

### Rapports

```
generate-report (à la demande, ou pg_cron via planifier_rapports() à 17 h Paris)
  → lecture des tâches, du journal, des process, documents, snapshots Chine (service role)
  → construireRapport() : chiffres déterministes (testés) → rapports.donnees
  → synthèse IA facultative à partir de ce JSON uniquement → rapports.synthese
  → rendreMarkdown() → rapports.contenu_md ; statut « pret » → notification en temps réel
Client : rendu React depuis `donnees`, export PDF (react-pdf) et Markdown.
```

### IA

Uniquement dans les Edge Functions (`_shared/ia.ts`, SDK officiel, sorties structurées JSON). Modèle lu dans
`parametres.modele_ia`. Aucune fonction ne bloque sans clé : message clair, et les rapports restent complets.

## Installation et clés des services

- **Assistant de premier lancement** (`src/features/installation/`) : sans configuration, l'app propose « Installer »
  (administrateur) ou « Rejoindre » (code d'invitation `HUBX1.…` = adresse + clé publique encodées).
- L'installation utilise l'**API de gestion Supabase** (`api.supabase.com`) avec un jeton d'accès saisi par l'administrateur,
  gardé en mémoire et jamais enregistré. Les appels passent par le plugin Tauri `http` (pas de CORS côté WebView).
  Étapes idempotentes : clés du projet → migrations embarquées (`import.meta.glob` de `supabase/migrations`, journalisées dans
  `supabase_migrations.schema_migrations` comme le fait la CLI) → déploiement des six fonctions (sources embarquées,
  fichiers résolus par `imports.ts`, chemins relatifs au dossier `functions`) → inscriptions fermées → adresse du serveur
  dans le Vault → compte administrateur (API d'administration Auth avec la clé serveur, en mémoire seulement) → clés des services.
- **Mise à jour du serveur** : `version_schema()` comparée à la dernière migration embarquée ; si l'app est plus récente,
  l'administrateur voit un bandeau et réapplique migrations manquantes + fonctions avec un jeton.
- **Clés des services** (IA, Azure) : saisies dans Paramètres › Clés et connexions (`definir_secret`, admin),
  stockées chiffrées dans le **Vault** Supabase sous `hubx_<nom>`, lues seulement par les Edge Functions
  (`lire_secret`, service role, `_shared/secrets.ts`, cache 60 s). Les variables d'environnement des fonctions restent
  prioritaires. Le secret de planification `hubx_cron_secret` est généré par la migration. La fonction `configuration`
  renvoie la présence des clés (booléens) et teste le fournisseur d'IA / Microsoft.
- **IA** : `_shared/ia.ts` appelle `POST <adresse>/chat/completions` (format OpenAI, compris par Mistral, DeepSeek, Qwen,
  OpenRouter, Groq…) avec la clé `ia_api_key`. Fournisseur, modèle et adresse dans `parametres` (presets dans
  `_shared/logic/ia.ts`, partagés avec l'app). Réponses JSON fiabilisées sans dépendre du fournisseur : mode
  `json_object`, schéma + exemple dans la consigne, mise en conformité tolérante (`conformer` : casse des valeurs,
  dates JJ/MM/AAAA, champs superflus…), puis une relance avec les défauts constatés. Une nouvelle tentative sur 429/5xx.
  Documents : texte extrait sur le serveur (PDF via unpdf, Office via fflate/SheetJS) envoyé à n'importe quel modèle ;
  images et PDF scannés envoyés tels quels seulement aux fournisseurs qui les lisent (Mistral).

## Bureau (Tauri)

- `src-tauri/src/lib.rs` : zone de notification (Ouvrir / Capture rapide / Quitter), fermeture = masquer,
  instance unique, fenêtre `capture` créée à la demande puis fermée (économie de mémoire), démarrage `--minimized`.
- Plugins : notification, global-shortcut (enregistré côté JS pour être personnalisable), autostart, updater (+ process
  pour relancer), window-state (sauf la capture), dialog + fs (enregistrer des fichiers), opener (ouvrir un document),
  http (API de gestion Supabase, portée limitée à `api.supabase.com` et `*.supabase.co`).
- Démarrage sans flash : fenêtre cachée jusqu'au premier rendu (`interface_prete`, appelé depuis un `useEffect` : `requestAnimationFrame` ne s'exécute pas dans une fenêtre cachée), fond `#F7F8F9`, filet de sécurité à 5 s. Même principe pour la fenêtre de capture.
- Windows : WebView2 passe en « mémoire réduite » (`MemoryUsageTargetLevel = LOW`) quand la fenêtre est cachée dans la zone
  de notification, sans suspendre les rappels.
- `src-tauri/capabilities/default.json` : liste minimale des permissions des deux fenêtres.
- Mises à jour : `latest.json` publié par la CI dans la GitHub Release, signature vérifiée avec la clé publique de `tauri.conf.json`.

## Performance

- Cache local des requêtes (TanStack Query persisté dans `localStorage`, 3 jours, vidé à la déconnexion) : l'app affiche
  les dernières données dès l'ouverture, y compris hors connexion, puis les rafraîchit.
- Pages et données des autres modules préchargées 1,5 s après l'ouverture : navigation ≈ 100 ms.

- Routes et modules lourds chargés à la demande (TipTap, Recharts, @react-pdf/renderer ne sont pas dans le bundle initial).
- Une seule connexion Realtime ; cache TanStack Query (60 s de fraîcheur), pas de rechargement au focus.
- WebView2 système (pas de Chromium embarqué) : RAM et taille d'installeur réduites.

## Développement local

- `npx supabase start` lance Postgres, Auth, Realtime, Storage et l'edge-runtime dans Docker ;
  `npx supabase db reset` rejoue migrations + `seed.sql` + `seeds/*.sql` (démo : comptes, tâches, snapshot Chine).
- `npm run fonctions:dev` (`scripts/fonctions-dev.ts`) sert les cinq fonctions avec le Deno du poste sur le port 54399,
  à utiliser avec `VITE_FUNCTIONS_URL=http://localhost:54399` quand le conteneur edge-runtime n'a pas accès à npm
  (proxy d'entreprise). Les secrets sont lus dans `supabase/functions/.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, clés facultatives).
- Tests : `npm test` (Vitest, logique partagée). CI : `.github/workflows/ci.yml` (typecheck, lint, tests, build, `deno check`).

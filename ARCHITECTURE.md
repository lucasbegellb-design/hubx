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
│ Auth (e-mail / mot de passe)   Postgres + RLS   Realtime   Storage (bucket documents)  │
│ Edge Functions (Deno) : sync-chine · analyze-document · structure-process ·            │
│                         generate-report · manage-members                              │
│ pg_cron + pg_net ─► sync-chine (*/15 min), generate-report (vendredi / fin de mois)    │
└──────┬─────────────────────────────────────────┬───────────────────────────────────────┘
       │ client credentials (Files.Read.All)     │ clé API (secret serveur)
┌──────▼──────────────┐                 ┌────────▼──────────┐
│ Microsoft Graph     │                 │ API Anthropic     │
│ OneDrive d'Edwin    │                 │ (claude-sonnet-5) │
└─────────────────────┘                 └───────────────────┘
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

| Table                            | Rôle                                      | Particularités                                                                                      |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `membres`                        | Qui a accès (admin / membre)              | `derniere_ouverture_at` alimente « depuis ta dernière visite »                                      |
| `domaines`, `projets`            | Référentiels                              | Domaines : admin ; projet archivé = hors vues par défaut                                            |
| `taches`                         | Tâches                                    | `done_at` géré par trigger ; suppression douce (`deleted_at`)                                       |
| `postits`                        | Post-its et rappels                       | Privés par défaut (`partage`), `rappel_envoye` remis à faux si le rappel change                     |
| `process`, `process_versions`    | Process et historique                     | Version créée par trigger à chaque changement de contenu ; recherche plein texte française          |
| `documents` + bucket `documents` | Bibliothèque                              | Analyse IA : `analyse_statut`, `resume`, `infos_cles`, `taches_suggerees`                           |
| `chine_source`                   | Lien de partage, état de synchro, mapping | Ligne unique, modifiable par l'admin                                                                |
| `chine_snapshots`                | Versions du fichier                       | Enregistré si le hash change, au moins une fois par jour                                            |
| `rapports`                       | Rapports générés                          | `donnees` (chiffres), `synthese` (IA), `contenu_md` ; unicité des rapports automatiques par période |
| `parametres`                     | Modèle IA, rapports auto                  | Ligne unique, admin                                                                                 |
| `journal_activite`               | Historique des actions                    | Alimenté par triggers (tâches, process, documents, post-its partagés) ; base du reporting           |

### Sécurité (RLS)

- `est_membre()` / `est_admin()` (fonctions `security definer`) conditionnent tous les accès ; `anon` n'a aucun droit.
- Post-its non partagés visibles uniquement par leur propriétaire.
- `parametres`, `chine_source`, `domaines`, rôles des membres : écriture admin seulement.
- `journal_activite`, `chine_snapshots`, `rapports` : aucune écriture client (triggers ou fonctions en service role).
- Les Edge Functions sont déployées avec `verify_jwt = false` et **vérifient elles-mêmes** le JWT puis l'appartenance
  à `membres` (`_shared/auth.ts`) ; pg_cron s'authentifie avec l'en-tête `x-cron-secret`.
- Le client ne contient que l'URL et la clé publique. Clé serveur, secrets Azure et clé Anthropic : secrets des fonctions.

## Flux principaux

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

## Bureau (Tauri)

- `src-tauri/src/lib.rs` : zone de notification (Ouvrir / Capture rapide / Quitter), fermeture = masquer,
  instance unique, fenêtre `capture` créée à la demande puis fermée (économie de mémoire), démarrage `--minimized`.
- Plugins : notification, global-shortcut (enregistré côté JS pour être personnalisable), autostart, updater (+ process
  pour relancer), window-state (sauf la capture), dialog + fs (enregistrer des fichiers), opener (ouvrir un document).
- `src-tauri/capabilities/default.json` : liste minimale des permissions des deux fenêtres.
- Mises à jour : `latest.json` publié par la CI dans la GitHub Release, signature vérifiée avec la clé publique de `tauri.conf.json`.

## Performance

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

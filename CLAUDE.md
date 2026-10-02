# CLAUDE.md — Hub XTIM

Logiciel desktop interne de XTIM SAS (Bionic Bird). Utilisateurs : Lucas (admin), Edwin (membre).
Interface 100 % en français. Source de vérité du besoin : cahier des charges (voir README) ; avancement : PLAN.md ; arbitrages : DECISIONS.md.

## Stack (imposée, ne pas changer)

- Desktop : Tauri 2 (`src-tauri/`, Rust). Plugins : notification, global-shortcut, autostart, updater, tray (core), single-instance, window-state, dialog, fs, process, opener, http.
- Front : React 18 + TS strict + Vite, Tailwind 3 + shadcn/ui (registre v3, `npx shadcn@2.3.0 add <comp>`), TanStack Query, Zustand (état UI seulement), react-hook-form + zod, date-fns (fr), cmdk, TipTap, Recharts, @react-pdf/renderer (chargé à la demande).
- Backend : Supabase (Postgres + RLS, Auth email/mdp, Realtime, Storage, Edge Functions Deno, pg_cron + pg_net).
- IA : fournisseur au choix, API « Chat Completions » (format OpenAI) appelée uniquement depuis les Edge Functions (`_shared/ia.ts`, `fetch`, sans SDK) : Mistral par défaut (offre gratuite, `mistral-small-latest`), DeepSeek, Qwen ou tout service compatible. Choix dans `parametres.ia_fournisseur` / `modele_ia` / `ia_url`, clé dans le Vault (`ia_api_key`, ou secret `IA_API_KEY`). Presets et logique JSON dans `_shared/logic/ia.ts`.

## Commandes

- `npm run dev` : front seul dans le navigateur (http://localhost:1420) — les API Tauri sont neutralisées hors Tauri.
- `npm run tauri dev` / `npm run tauri build` : app desktop / installeur.
- `npm run typecheck` · `npm run lint` · `npm run format` · `npm test` (Vitest) · `npm run check` (les trois).
- Supabase local : `npx supabase start` (Docker), `npx supabase db reset` (migrations + seed), `npx supabase functions serve`, `npm run gen:types`.
- Fixture Chine : `npm run fixture:chine` (régénère `fixtures/suivi_chine_exemple.xlsx`, `supabase/functions/sync-chine/fixture.ts` et `supabase/seeds/chine.sql`).
- Fonctions en local sans edge-runtime : `npm run fonctions:dev` (Deno du poste, port 54399) + `VITE_FUNCTIONS_URL=http://localhost:54399` dans `.env` ; secrets dans `supabase/functions/.env.local`.
- Vérifier les fonctions : `cd supabase/functions && deno check --allow-import --node-modules-dir=none <fn>/index.ts`.
- Release : tag `v*` (= version de package.json) → `.github/workflows/release.yml`. Build Windows sans publication : workflow manuel « Build Windows ».

## Arborescence

- `src/app` : providers, routeur (routes lazy), coquille (barre latérale, bandeau hors ligne, palette).
- `src/features/<module>` : une page + `api.ts` (queries/mutations TanStack) + composants du module.
- `src/components/ui` : shadcn (ne pas réécrire à la main) ; `src/components/*` : composants communs.
- `src/features/installation` : assistant de premier lancement, client de l'API de gestion Supabase, mise à jour du serveur.
- `src/lib` : client Supabase, types générés (`database.types.ts`), realtime, pont Tauri (`tauri.ts`), formatage.
- `supabase/functions/_shared/logic` : **logique métier pure** partagée client (alias `@shared`) + Edge Functions. Pas de dépendance, imports relatifs avec extension `.ts`, pas de `Deno.*`.
- `supabase/functions/<fn>` : Edge Functions (sync-chine, analyze-document, structure-process, generate-report, manage-members). Elles vérifient elles-mêmes JWT + membre (`_shared/auth.ts`, `verify_jwt = false`), pg_cron passe `x-cron-secret`.
- `supabase/migrations` : SQL versionné. `supabase/seed.sql` : données de démo locales uniquement.
- `tests/` : Vitest sur la logique critique.

## Conventions

- Textes UI en français, casse de phrase, tutoiement. Toast = libellé du bouton au participe (« Archiver » → « Archivé »).
- Couleurs uniquement via tokens Tailwind (`bg-card`, `text-muted-foreground`, `text-urgent`, `text-retard`, `text-fait`…). Pas d'ombres décoratives, bordures fines.
- Toute écriture passe par une mutation qui appelle `verifierEcriture()` (hors ligne → refus immédiat) puis `valider(schema…)` (`src/lib/schemas.ts`, aligné sur les CHECK SQL) ; les requêtes utilisent les clés `[table, ...]` (invalidées par le realtime).
- Appels d'Edge Functions : toujours via `appelerFonction()` (`src/lib/fonctions.ts`) qui traduit les erreurs `{ erreur }` en messages lisibles.
- Nouvelle Edge Function : dossier `supabase/functions/<nom>` + entrée `[functions.<nom>] verify_jwt = false` dans `config.toml` + `FONCTIONS` dans `src/features/installation/paquet.ts` + `scripts/fonctions-dev.ts` (le test `tests/installation.test.ts` vérifie la liste).
- Clés des services : lues via `secret()` (`_shared/secrets.ts` : variable d'env puis Vault `hubx_<nom>`), écrites par l'admin via `definir_secret` ; jamais renvoyées au client.
- Nouvelle migration : elle sera appliquée par l'assistant / « Mettre à jour le serveur » (SQL exécuté d'un bloc) — l'écrire rejouable autant que possible.
- Nouvelle table : migration + RLS + ajout à la publication `supabase_realtime` + `npm run gen:types` + clé realtime dans `src/lib/realtime.ts` + export complet (`exportComplet.ts`).
- Tests : toute logique métier nouvelle va dans `_shared/logic` avec un test dans `tests/`.
- Monter Tauri ou un plugin : paquet npm `@tauri-apps/*` et crate Rust ensemble, même majeure.mineure (`cargo update` dans `src-tauri/`), sinon `tauri build` échoue (vérifié par `tests/versions-tauri.test.ts`).
- Dates métier (échéances) = chaînes `YYYY-MM-DD` en heure de Paris (`@shared/dates.ts`).
- Secrets : seule la clé anon côté client. Jamais de clé service / Azure / Anthropic dans `src/`.
- Une migration = un fichier horodaté ; ne jamais modifier une migration déjà appliquée en prod.

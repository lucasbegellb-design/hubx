# CLAUDE.md — Hub XTIM

Logiciel desktop interne de XTIM SAS (Bionic Bird). Utilisateurs : Lucas (admin), Edwin (membre).
Interface 100 % en français. Source de vérité du besoin : cahier des charges (voir README) ; avancement : PLAN.md ; arbitrages : DECISIONS.md.

## Stack (imposée, ne pas changer)
- Desktop : Tauri 2 (`src-tauri/`, Rust). Plugins : notification, global-shortcut, autostart, updater, tray (core), single-instance, window-state, dialog, fs, process, opener.
- Front : React 18 + TS strict + Vite, Tailwind 3 + shadcn/ui (registre v3, `npx shadcn@2.3.0 add <comp>`), TanStack Query, Zustand (état UI seulement), react-hook-form + zod, date-fns (fr), cmdk, TipTap, Recharts, @react-pdf/renderer (chargé à la demande).
- Backend : Supabase (Postgres + RLS, Auth email/mdp, Realtime, Storage, Edge Functions Deno, pg_cron + pg_net).
- IA : API Anthropic uniquement depuis les Edge Functions (secret `ANTHROPIC_API_KEY`). Modèle dans `parametres.modele_ia` (défaut `claude-sonnet-5`).

## Commandes
- `npm run dev` : front seul dans le navigateur (http://localhost:1420) — les API Tauri sont neutralisées hors Tauri.
- `npm run tauri dev` / `npm run tauri build` : app desktop / installeur.
- `npm run typecheck` · `npm run lint` · `npm run format` · `npm test` (Vitest) · `npm run check` (les trois).
- Supabase local : `npx supabase start` (Docker), `npx supabase db reset` (migrations + seed), `npx supabase functions serve`, `npm run gen:types`.
- Fixture Chine : `npm run fixture:chine` (régénère `fixtures/suivi_chine_exemple.xlsx` + `supabase/functions/sync-chine/fixture.ts`).

## Arborescence
- `src/app` : providers, routeur (routes lazy), coquille (barre latérale, bandeau hors ligne, palette).
- `src/features/<module>` : une page + `api.ts` (queries/mutations TanStack) + composants du module.
- `src/components/ui` : shadcn (ne pas réécrire à la main) ; `src/components/*` : composants communs.
- `src/lib` : client Supabase, types générés (`database.types.ts`), realtime, pont Tauri (`tauri.ts`), formatage.
- `supabase/functions/_shared/logic` : **logique métier pure** partagée client (alias `@shared`) + Edge Functions. Pas de dépendance, imports relatifs avec extension `.ts`, pas de `Deno.*`.
- `supabase/functions/<fn>` : Edge Functions (sync-chine, analyze-document, structure-process, generate-report, manage-members).
- `supabase/migrations` : SQL versionné. `supabase/seed.sql` : données de démo locales uniquement.
- `tests/` : Vitest sur la logique critique.

## Conventions
- Textes UI en français, casse de phrase, tutoiement. Toast = libellé du bouton au participe (« Archiver » → « Archivé »).
- Couleurs uniquement via tokens Tailwind (`bg-card`, `text-muted-foreground`, `text-urgent`, `text-retard`, `text-fait`…). Pas d'ombres décoratives, bordures fines.
- Toute écriture passe par un hook `useXxxMutation` qui vérifie `useOnline()` ; les requêtes utilisent les clés `[table, ...]` (invalidées par le realtime).
- Dates métier (échéances) = chaînes `YYYY-MM-DD` en heure de Paris (`@shared/dates.ts`).
- Secrets : seule la clé anon côté client. Jamais de clé service / Azure / Anthropic dans `src/`.
- Une migration = un fichier horodaté ; ne jamais modifier une migration déjà appliquée en prod.

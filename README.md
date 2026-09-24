# Hub XTIM

Logiciel de bureau interne de **XTIM SAS** (Marseille, drones biomimétiques Bionic Bird).
Un seul endroit pour les tâches, les post-its et rappels, les process, les documents et le suivi
des fournisseurs chinois, avec des rapports sur n'importe quelle période et un reporting
hebdomadaire et mensuel automatique. Conçu aussi pour la **passation** : données exportables,
process documentés, documentation technique complète.

- Application Windows légère (Tauri 2, ~10 Mo), build macOS également produit par la CI.
- Interface 100 % en français, thème clair / sombre, tout au clavier (`Ctrl K`).
- Données partagées dans le cloud (Supabase), synchronisées en temps réel entre Lucas et Edwin.

## Modules

| Module          | Ce qu'il fait                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aujourd'hui** | Tâches en retard, du jour et urgentes, rappels du jour, alertes Chine, ce qui a changé depuis la dernière ouverture, dernier rapport. Barre de saisie rapide. |
| **Tâches**      | Liste groupée par échéance, filtres, recherche, panneau de détail, raccourcis `N` `X` `E` `F` `/`, action « Fait ».                                           |
| **Post-its**    | Mur de post-its privés ou partagés, épinglage, rappels (notification Windows), conversion en tâche.                                                           |
| **Process**     | Bibliothèque au modèle XTIM, versions restaurables, « Structurer un brouillon » (IA), exports PDF/Markdown, pack de passation.                                |
| **Suivi Chine** | Lecture seule du fichier Excel d'Edwin (OneDrive), onglets filtrables, mapping des colonnes, montants, alertes, historique des évolutions.                    |
| **Documents**   | Bibliothèque par glisser-déposer, analyse IA (catégorie, résumé, infos clés, tâches suggérées).                                                               |
| **Rapports**    | À la demande ou automatiques (vendredi 17 h, dernier jour ouvré 17 h), chiffres calculés, synthèse IA, export PDF.                                            |
| **Paramètres**  | Comptes et rôles, domaines et projets, source Chine, modèle IA, raccourcis, thème, démarrage auto, mises à jour, export complet.                              |

## Démarrage rapide (développement)

Prérequis : Node.js 22, Rust stable, Docker (pour Supabase local), Deno 2 (facultatif).
Sous Linux, les [prérequis Tauri](https://tauri.app/start/prerequisites/) (webkit2gtk…).

```bash
npm ci
npx supabase start            # base locale (Docker) : migrations + données de démo
cp .env.example .env          # puis VITE_SUPABASE_URL=http://127.0.0.1:54321 et la clé anon affichée par `supabase start`
npm run tauri dev             # application de bureau
# ou : npm run dev            # front seul dans le navigateur (http://localhost:1420)
```

Comptes de démonstration locaux : `lucas@xtim.test` (admin) et `edwin@xtim.test`, mot de passe `xtim-demo-2026`.

## Commandes

| Commande                        | Rôle                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `npm run tauri dev`             | Application de bureau en développement                               |
| `npm run tauri build`           | Installeur Windows (`src-tauri/target/release/bundle/nsis` et `msi`) |
| `npm run dev`                   | Front seul dans le navigateur                                        |
| `npm run check`                 | Typecheck + lint + tests                                             |
| `npm test`                      | Tests Vitest (logique métier)                                        |
| `npm run format`                | Prettier                                                             |
| `npm run gen:types`             | Regénère `src/lib/database.types.ts` depuis la base locale           |
| `npm run fixture:chine`         | Regénère le fichier Excel d'exemple du Suivi Chine                   |
| `npm run fonctions:dev`         | Sert les Edge Functions avec le Deno du poste (voir ARCHITECTURE.md) |
| `npx supabase db reset`         | Réinitialise la base locale (migrations + démo)                      |
| `npx supabase functions deploy` | Déploie les Edge Functions sur le projet lié                         |

## Documentation

- [SETUP.md](SETUP.md) — mise en service pas à pas (Supabase, Azure, comptes, GitHub, première version).
- [ARCHITECTURE.md](ARCHITECTURE.md) — modules, flux de données, sécurité.
- [PASSATION.md](PASSATION.md) — administrer, exporter, mettre à jour et faire évoluer l'outil.
- [CLAUDE.md](CLAUDE.md) — contexte et conventions pour Claude Code. [DECISIONS.md](DECISIONS.md) — arbitrages.

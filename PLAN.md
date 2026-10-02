# PLAN — Hub XTIM

Checklist des phases (cf. cahier des charges §9). Cocher au fur et à mesure.

- [x] 1. Plan, CLAUDE.md, scaffolding Tauri 2 + React 18 + Vite, tokens design, coquille nav, auth
- [x] 2. Schéma SQL, migrations, RLS, triggers journal_activite, seed, types générés
- [x] 3. Tâches, Post-its, Aujourd'hui, saisie rapide, palette Ctrl+K
- [x] 4. Process (modèle, versions, IA, exports PDF/MD, pack passation) + Documents (upload, analyse IA)
- [x] 5. Suivi Chine : fixture xlsx, mode mock, sync-chine, visualiseur, mapping, KPI, alertes, diff
- [x] 6. Rapports : agrégation déterministe, synthèse IA, PDF, pg_cron hebdo/mensuel
- [x] 7. Desktop : tray, notifications, raccourci global, autostart, updater, CI release
- [x] 8. Qualité (typecheck, lint, tests, build), docs (README, SETUP, ARCHITECTURE, PASSATION), récap
- [x] 9. Fluidité (cache persistant, préchargement, démarrage sans flash, mémoire WebView2), assistant de premier
      lancement (installation du serveur + clés des services depuis l'app), installeur Windows validé par le workflow
      « Build Windows » et assistant testé de bout en bout dans l'application de bureau

## Version « ultime » (un lot = une version)

- [x] 10. v0.3.0 — mises à jour automatiques signées, sauvegarde automatique hebdomadaire
- [x] 11. v0.4.0 — tâches récurrentes, sous-tâches, commentaires et @mentions
- [x] 12. v0.5.0 — calendrier + abonnement Outlook
- [ ] 13. v0.6.0 — santé des process + « Exécuter ce process »
- [ ] 14. v0.7.0 — recherche intelligente, « Demande à Hub », brief du matin
- [ ] 15. v0.8.0 — hors ligne complet
- [ ] 16. v0.9.0 — version mobile (web) sur GitHub Pages
- [ ] 17. v1.0.0 — e-mails → tâches (glisser-déposer + boîte dédiée)

## Reprise

Lire CLAUDE.md (stack, commandes, conventions) puis DECISIONS.md. Un commit par phase.

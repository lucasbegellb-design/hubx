# DECISIONS

Une ligne par arbitrage non bloquant.

- Tailwind 3 + shadcn@2.3.0 (composants `forwardRef`) : compatibles React 18 imposé ; le registre Tailwind 4 suppose React 19.
- React Router 6 (mode déclaratif) pour les routes lazy ; pas de framework.
- Sélecteur de date natif (`<input type="date">`) plutôt qu'un calendrier : plus léger, accessible au clavier.
- Toasts : sonner (recommandé par shadcn). Icônes : lucide-react. Police IBM Plex Sans embarquée (@fontsource), pas de CDN.
- Plugins Tauri ajoutés hors liste : `process` (relance après mise à jour) et `opener` (ouvrir un document / lien).
- Config serveur : URL + clé anon injectées au build (secrets CI) ; à défaut, écran « Connexion au serveur » au premier lancement (localStorage).
- Inscriptions publiques désactivées ; premier compte connecté sans admin existant peut s'auto-promouvoir (`devenir_premier_admin`), ensuite l'admin gère les comptes.
- Statuts/rôles en `text` + contraintes CHECK plutôt qu'en types enum (évolution plus simple).
- Colonnes ajoutées au modèle : `deleted_at` (soft delete) sur taches/process/documents, `process.contenu_texte` + `recherche` (plein texte français), `documents.analyse_message`, `rapports.synthese/erreur`, `chine_source.derniere_source`, `membres.email/derniere_ouverture_at`, table `parametres` (ligne unique).
- `taches.domaine_id` nullable (groupe « Sans domaine ») ; l'UI propose toujours un domaine.
- Versions de process créées par trigger (à chaque changement de contenu/titre), pas par le client.
- Journal : résumé compact (sans notes ni contenus complets) ; une édition des notes seule ne crée pas d'entrée.
- Domaines modifiables par l'admin seulement ; projets par tous les membres (suppression admin).
- Référentiels (domaines, projet Swift, lignes uniques chine_source/parametres) dans une migration ; `seed.sql` = démo locale uniquement.
- Edge Functions en `verify_jwt = false` + vérification JWT/membre dans le code : compatible nouvelles clés API et appel pg_cron via `x-cron-secret`.
- Appels IA via le SDK officiel `npm:@anthropic-ai/sdk` + structured outputs (`output_config.format`), pas de fetch brut.
- Fenêtre de capture : créée à la demande par Rust puis fermée (économie de RAM) ; le raccourci global est enregistré côté JS pour être personnalisable.

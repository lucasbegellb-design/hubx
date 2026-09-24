# Passation de Hub XTIM

Ce document permet à un successeur (ou à Edwin) de reprendre l'outil : l'administrer, récupérer les données,
publier des mises à jour et le faire évoluer. Il complète [SETUP.md](SETUP.md) (installation) et
[ARCHITECTURE.md](ARCHITECTURE.md) (fonctionnement technique).

## 1. En bref

- **Ce que c'est** : l'outil de travail quotidien de l'assistant(e) de direction de XTIM — tâches, post-its, process,
  documents, suivi des fournisseurs chinois, rapports hebdomadaires et mensuels.
- **Où sont les données** : projet Supabase `hub-xtim` (base Postgres en Europe + stockage des fichiers).
  Rien n'est stocké uniquement sur un PC (hors brouillons de saisie en cours).
- **Qui administre** : le(s) compte(s) au rôle _Administrateur_ (Paramètres › Comptes et rôles).
- **Ce qui coûte** : Supabase (gratuit ou Pro), API Anthropic (à l'usage), GitHub (gratuit). Aucun autre abonnement.

## 2. Accès à transmettre (checklist de départ)

À remettre au successeur et à Edwin **avant le départ**, via le coffre-fort de mots de passe de l'entreprise :

- [ ] Compte **Supabase** : inviter le successeur dans l'organisation (Organization → Team → Invite, rôle _Owner_).
- [ ] Compte **GitHub** : ajouter le successeur comme administrateur du dépôt `hubx` (Settings → Collaborators),
      ou transférer le dépôt à un compte / une organisation XTIM (Settings → Transfer).
- [ ] **Clé privée de mise à jour** (`hub-xtim.key`) et son mot de passe.
- [ ] Console **Anthropic** : ajouter le successeur à l'organisation, ou créer une nouvelle clé à son nom
      (`npx supabase secrets set ANTHROPIC_API_KEY=...`) et révoquer l'ancienne.
- [ ] Application **Azure** « Hub XTIM – lecture Suivi Chine » : ajouter le successeur comme propriétaire ;
      noter la date d'expiration du secret client.
- [ ] Dans l'app : nommer le successeur **Administrateur**, puis retirer l'accès du compte sortant
      (Paramètres › Comptes et rôles → icône « retirer ») : son compte est bloqué, ses données restent.
- [ ] Faire un **export complet** (§ 4) et le ranger sur le serveur/OneDrive de l'entreprise.
- [ ] Générer le **pack de passation** (Process › Pack de passation) et vérifier que chaque process actif est à jour.

## 3. Administration courante

| Besoin                                                                         | Où                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Ajouter / retirer une personne, changer un rôle, réinitialiser un mot de passe | Paramètres › Comptes et rôles                                                                   |
| Ajouter un domaine, renommer, changer la couleur ou l'ordre                    | Paramètres › Domaines et projets (admin)                                                        |
| Créer / archiver un projet                                                     | Paramètres › Domaines et projets                                                                |
| Nouveau lien du fichier Excel d'Edwin, mapping des colonnes                    | Paramètres › Suivi Chine (admin)                                                                |
| Changer de modèle IA, couper les rapports automatiques                         | Paramètres › IA et rapports (admin)                                                             |
| Vérifier les tâches planifiées                                                 | Supabase → SQL Editor : `select * from cron.job_run_details order by start_time desc limit 20;` |
| Consulter les erreurs des fonctions                                            | Supabase → Edge Functions → _nom_ → Logs                                                        |

### Échéances à surveiller

| Quoi                    | Quand                                             | Action                                                                                                                                       |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secret client Azure** | à la date notée lors de la création (24 mois max) | Entra → l'application → Certificats et secrets → nouveau secret, puis `npx supabase secrets set AZURE_CLIENT_SECRET=...`, supprimer l'ancien |
| Crédit Anthropic        | selon l'offre                                     | Console Anthropic → Billing                                                                                                                  |
| Projet Supabase gratuit | se met en pause après 7 jours sans activité       | Passer en Pro ou relancer depuis le tableau de bord                                                                                          |

## 4. Exporter et sauvegarder les données

- **Export complet** : Paramètres › Mises à jour et export → _Exporter toutes les données_. Produit un zip contenant
  chaque table en JSON (fidèle, réimportable) et en CSV (ouvrable dans Excel, séparateur `;`), plus tous les documents
  déposés (`fichiers/`). Les post-its privés des autres membres n'y figurent pas (ils restent privés).
- **Sauvegardes Supabase** : quotidiennes sur l'offre Pro (Database → Backups), avec restauration à un instant donné en option.
- **Sauvegarde brute de la base** (pour un informaticien) : `npx supabase db dump --linked -f sauvegarde.sql`
  (+ `--data-only` pour les données seules).

### Restaurer dans un nouveau projet

1. Créer un projet Supabase et appliquer les migrations (SETUP.md §§ 2 à 6).
2. Importer les données : `psql "<chaîne de connexion>" -f sauvegarde.sql`, ou réimporter les JSON de l'export complet
   (Table Editor → Import data from CSV table par table, dans l'ordre : domaines, projets, membres, taches, process,
   process_versions, documents, postits, chine_source, chine_snapshots, rapports, parametres, journal_activite).
3. Recharger les fichiers de `fichiers/` dans le bucket `documents` en conservant les chemins.
4. Mettre à jour `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (secrets GitHub) et publier une version, ou saisir la
   nouvelle adresse au premier lancement si l'app n'embarque pas de configuration.

## 5. Mettre à jour l'application

1. Modifier le code (voir § 6), vérifier : `npm run check`.
2. Incrémenter la version : `npm version 0.2.0 --no-git-tag-version`, committer.
3. Taguer et pousser : `git tag v0.2.0 && git push origin main --tags`.
4. GitHub Actions construit Windows + macOS et publie la release : les postes proposent la mise à jour au démarrage.
5. Si le schéma a changé : `npx supabase db push` **avant** de publier. Si une fonction a changé :
   `npx supabase functions deploy <nom>`.

Règles : ne jamais modifier une migration déjà appliquée (en créer une nouvelle : `npx supabase migration new <nom>`) ;
toujours tester localement (`npx supabase start`, `npx supabase db reset`).

## 6. Faire évoluer l'outil avec Claude Code

Le dépôt est préparé pour être repris par Claude Code (ou un développeur) :

- `CLAUDE.md` : contexte, stack imposée, commandes, conventions (lu automatiquement par Claude Code).
- `DECISIONS.md` : chaque arbitrage pris et pourquoi. `PLAN.md` : historique des phases de construction.
- Logique métier isolée et testée : `supabase/functions/_shared/logic/` + `tests/`.

Démarche conseillée :

1. Installer Claude Code (https://claude.com/claude-code), ouvrir le dossier `hubx`, lancer `claude`.
2. Décrire le besoin en français, par exemple :
   « Ajoute un champ _fournisseur_ aux tâches, filtrable dans la liste, et visible dans les rapports. Crée la migration,
   mets à jour les types, la logique de rapport et ses tests. »
3. Demander systématiquement : migration SQL + `npm run gen:types` + tests + `npm run check` + mise à jour de la
   documentation concernée.
4. Relire la proposition, tester localement (`npm run tauri dev` sur une base locale), puis publier (§ 5).

Évolutions faciles déjà prévues par la structure : nouveaux rôles de colonnes Chine (`ROLES` dans `chine.ts`), nouvelles
sections de rapport (`construireRapport` + `rendreMarkdown` + `VueRapport` + PDF), nouveaux raccourcis de période
(`dates.ts`), nouvelles catégories de documents (`analyze-document`).

## 7. Limites connues

- Jours fériés ignorés pour le « dernier jour ouvré » du rapport mensuel.
- Montants Chine additionnés par devise, sans conversion de change.
- Les exports PDF n'affichent pas les caractères chinois (police latine).
- Sans certificat de signature de code, Windows SmartScreen avertit à l'installation (pas lors des mises à jour).
- Les mises à jour automatiques exigent des releases publiquement téléchargeables (SETUP.md § 9.3).

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
- Process : enregistrement explicite (Ctrl+S) pour ne pas créer une version à chaque frappe ; brouillon local conservé jusqu'à l'enregistrement ; « Dernière révision » renseignée automatiquement.
- Pack de passation : sommaire cliquable (liens internes) sans numéros de page (non calculables de façon fiable avec react-pdf).
- PDF : police IBM Plex Sans (sous-ensemble latin) ; les caractères chinois éventuels ne s'affichent pas dans les exports PDF.
- Documents : analyse lancée par le client juste après le dépôt ; en cas d'échec d'appel, statut « erreur » + message et bouton « Relancer ». Limites : PDF 20 Mo, image 5 Mo, texte 150 000 caractères (analyse sur le début, signalée).
- Word/PowerPoint/OpenDocument : texte extrait côté fonction (fflate) ; Excel/CSV via SheetJS (CDN officiel, pas le paquet npm obsolète).
- Glisser-déposer : `dragDropEnabled: false` sur la fenêtre Tauri pour utiliser le drag & drop HTML5.
- Dév local : `npm run fonctions:dev` sert toutes les Edge Functions via le Deno du poste (quand le conteneur edge-runtime n'a pas d'accès npm) ; activé par `VITE_FUNCTIONS_URL`.
- Suivi Chine : mapping multi-onglets (`{ onglets: [{ onglet, colonnes }] }`, ancien format mono-onglet accepté) ; colonnes référencées par libellé d'en-tête.
- Détection d'en-tête : ligne la plus « textuelle » parmi les 15 premières (tolère un titre au-dessus du tableau) ; en-têtes vides → « Colonne N », doublons suffixés.
- Payé = date de paiement renseignée ou statut « payé/réglé/soldé/paid » (hors « impayé/à payer ») ; livré = date réelle ou statut « livré/reçu/delivered ».
- KPI par devise (jamais de conversion de change) ; alertes = paiements non réglés échus ou dus sous 7 jours + livraisons prévues dépassées sans date réelle.
- Diff de snapshots : clé = n° PO mappé s'il est unique, sinon première colonne aux valeurs uniques, sinon ligne entière ; colonnes réalignées par libellé.
- Snapshot enregistré si le hash SHA-256 du contenu normalisé change ou si aucun snapshot n'existe pour le jour (Paris). Aucune purge automatique (volumes faibles).
- Mode démo : actif tant que les secrets Azure sont absents ; fichier d'exemple embarqué en base64 dans la fonction (généré par `npm run fixture:chine`).
- pg_cron : appels via `net.http_post` + secrets Vault `hubx_url` / `hubx_cron_secret` ; rapports déclenchés à 15 h et 16 h UTC, filtrés sur 17 h heure de Paris (gère l'heure d'été).

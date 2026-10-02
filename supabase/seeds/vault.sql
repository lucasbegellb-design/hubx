-- Développement local : adresse vue depuis le conteneur Postgres + secret de planification connu.
select public.enregistrer_secret('url', 'http://supabase_kong_hub-xtim:8000');
select public.enregistrer_secret('cron_secret', 'secret-local-de-developpement');

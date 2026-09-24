-- Développement local : secrets utilisés par pg_cron pour appeler les Edge Functions.
select vault.create_secret('http://supabase_kong_hub-xtim:8000', 'hubx_url');
select vault.create_secret('secret-local-de-developpement', 'hubx_cron_secret');

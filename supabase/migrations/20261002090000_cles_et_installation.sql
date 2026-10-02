-- =====================================================================
-- Clés des services et installation depuis l'application
-- - Les clés (Anthropic, Azure) sont saisies par l'administrateur dans l'app et stockées
--   chiffrées dans le Vault. Elles ne sont jamais relisibles par un client : seules les
--   Edge Functions (service role) les lisent. Les secrets d'environnement des fonctions
--   restent prioritaires s'ils sont définis.
-- - Le secret de planification (pg_cron → fonctions) est généré automatiquement.
-- - version_schema() permet à l'app de proposer la mise à jour du serveur.
-- =====================================================================

-- Écriture interne (installateur via l'API de gestion Supabase, ou definir_secret)
create or replace function public.enregistrer_secret(p_nom text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := 'hubx_' || p_nom;
  v_id uuid;
begin
  if p_nom not in ('anthropic_api_key', 'azure_tenant_id', 'azure_client_id', 'azure_client_secret', 'url', 'cron_secret') then
    raise exception 'Secret non autorisé : %', p_nom using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = v_nom;
  if coalesce(btrim(p_valeur), '') = '' then
    if v_id is not null then
      delete from vault.secrets where id = v_id;
    end if;
    return;
  end if;
  if v_id is null then
    perform vault.create_secret(btrim(p_valeur), v_nom);
  else
    perform vault.update_secret(v_id, btrim(p_valeur));
  end if;
end;
$$;
revoke all on function public.enregistrer_secret(text, text) from public, anon, authenticated;
grant execute on function public.enregistrer_secret(text, text) to service_role;

-- Écriture par l'administrateur depuis l'app (jamais de lecture côté client)
create or replace function public.definir_secret(p_nom text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action réservée à l''administrateur.' using errcode = '42501';
  end if;
  if p_nom not in ('anthropic_api_key', 'azure_tenant_id', 'azure_client_id', 'azure_client_secret', 'url') then
    raise exception 'Clé non modifiable depuis l''application : %', p_nom using errcode = '22023';
  end if;
  if p_nom = 'url' and coalesce(p_valeur, '') !~* '^https?://' then
    raise exception 'Adresse du serveur invalide.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_valeur, '')) > 4000 then
    raise exception 'Valeur trop longue.' using errcode = '22023';
  end if;
  perform public.enregistrer_secret(p_nom, p_valeur);
end;
$$;
revoke all on function public.definir_secret(text, text) from public, anon;
grant execute on function public.definir_secret(text, text) to authenticated;

-- Lecture réservée aux Edge Functions (service role)
create or replace function public.lire_secret(p_nom text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'hubx_' || p_nom limit 1;
$$;
revoke all on function public.lire_secret(text) from public, anon, authenticated;
grant execute on function public.lire_secret(text) to service_role;

-- Présence des clés (booléens uniquement) pour l'écran « Clés et connexions »
create or replace function public.secrets_presents()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.est_membre() then
    return '{}'::jsonb;
  end if;
  select jsonb_build_object(
    'anthropic', bool_or(name = 'hubx_anthropic_api_key'),
    'azure', count(*) filter (where name in ('hubx_azure_tenant_id', 'hubx_azure_client_id', 'hubx_azure_client_secret')) = 3,
    'url', bool_or(name = 'hubx_url'),
    'cron', bool_or(name = 'hubx_cron_secret')
  ) into v
  from vault.secrets
  where name like 'hubx\_%';
  return coalesce(v, '{}'::jsonb);
end;
$$;
revoke all on function public.secrets_presents() from public, anon;
grant execute on function public.secrets_presents() to authenticated;

-- Dernière migration appliquée (comparée par l'app à celles qu'elle embarque)
create or replace function public.version_schema()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    return null;
  end if;
  execute 'select max(version) from supabase_migrations.schema_migrations' into v;
  return v;
end;
$$;
revoke all on function public.version_schema() from public, anon;
grant execute on function public.version_schema() to authenticated;

-- Secret de planification généré une fois pour toutes
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'hubx_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'hubx_cron_secret');
  end if;
end;
$$;

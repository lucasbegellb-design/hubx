-- =====================================================================
-- IA : fournisseur au choix (Mistral par défaut, DeepSeek, Qwen ou tout service compatible
-- OpenAI) à la place de l'API Anthropic. Rejouable.
-- - parametres.ia_fournisseur / ia_url / modele_ia : choix de l'administrateur (lisibles par
--   les membres, comme le reste des paramètres) ;
-- - la clé API du fournisseur est un secret du Vault (`hubx_ia_api_key`), jamais relisible
--   par un client.
-- =====================================================================

alter table public.parametres add column if not exists ia_fournisseur text not null default 'mistral';
alter table public.parametres add column if not exists ia_url text;
alter table public.parametres alter column modele_ia set default 'mistral-small-latest';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'parametres_ia_fournisseur_check') then
    alter table public.parametres add constraint parametres_ia_fournisseur_check
      check (ia_fournisseur in ('mistral', 'deepseek', 'qwen', 'autre'));
  end if;
  -- https (ou http sur la machine locale, pour le développement) ; obligatoire pour « autre »
  if not exists (select 1 from pg_constraint where conname = 'parametres_ia_url_check') then
    alter table public.parametres add constraint parametres_ia_url_check
      check (
        ia_url is null
        or (
          char_length(ia_url) <= 300
          and (
            ia_url ~* '^https://[^[:space:]/]+\.[^[:space:]/]+(/[^[:space:]]*)?$'
            or ia_url ~* '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^[:space:]]*)?$'
          )
        )
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parametres_ia_autre_check') then
    alter table public.parametres add constraint parametres_ia_autre_check
      check (ia_fournisseur <> 'autre' or ia_url is not null);
  end if;
end;
$$;

-- Un modèle Anthropic configuré auparavant n'a plus de sens : modèle Mistral par défaut.
update public.parametres
set modele_ia = 'mistral-small-latest', ia_fournisseur = 'mistral', ia_url = null
where modele_ia like 'claude-%';

-- Clés autorisées : `ia_api_key` remplace `anthropic_api_key`
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
  if p_nom not in ('ia_api_key', 'azure_tenant_id', 'azure_client_id', 'azure_client_secret', 'url', 'cron_secret') then
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
  if p_nom not in ('ia_api_key', 'azure_tenant_id', 'azure_client_id', 'azure_client_secret', 'url') then
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
    'ia', bool_or(name = 'hubx_ia_api_key'),
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

-- L'ancienne clé Anthropic n'est plus utilisée : on ne la garde pas.
delete from vault.secrets where name = 'hubx_anthropic_api_key';

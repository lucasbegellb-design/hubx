-- =====================================================================
-- Planification (pg_cron + pg_net) : synchro Chine toutes les 15 min,
-- rapports hebdo (vendredi 17 h) et mensuel (dernier jour ouvré 17 h), heure de Paris.
-- Les appels aux Edge Functions utilisent deux secrets du Vault (voir SETUP.md) :
--   hubx_url          : https://<projet>.supabase.co
--   hubx_cron_secret  : même valeur que le secret CRON_SECRET des fonctions
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.appeler_fonction(p_nom text, p_corps jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'hubx_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hubx_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'Hub XTIM : secrets hubx_url / hubx_cron_secret absents du Vault (voir SETUP.md).';
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_nom,
    body := p_corps,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 120000
  );
end;
$$;

-- Rapports automatiques : le job tourne à 15 h et 16 h UTC, la fonction ne déclenche qu'à 17 h à Paris
-- (été comme hiver). Jours fériés non pris en compte.
create or replace function public.planifier_rapports()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := now() at time zone 'Europe/Paris';
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_dernier date;
begin
  if extract(hour from v_local) <> 17 then
    return;
  end if;
  if not coalesce((select rapports_auto from public.parametres limit 1), true) then
    return;
  end if;
  if extract(isodow from v_jour) = 5 then
    perform public.appeler_fonction('generate-report', jsonb_build_object('type', 'hebdo'));
  end if;
  v_dernier := (date_trunc('month', v_jour) + interval '1 month - 1 day')::date;
  while extract(isodow from v_dernier) > 5 loop
    v_dernier := v_dernier - 1;
  end loop;
  if v_jour = v_dernier then
    perform public.appeler_fonction('generate-report', jsonb_build_object('type', 'mensuel'));
  end if;
end;
$$;

revoke execute on function public.appeler_fonction(text, jsonb) from public, anon, authenticated;
revoke execute on function public.planifier_rapports() from public, anon, authenticated;

select cron.schedule('hubx-sync-chine', '*/15 * * * *', $$select public.appeler_fonction('sync-chine')$$);
select cron.schedule('hubx-rapports', '0 15,16 * * 1-5', $$select public.planifier_rapports()$$);

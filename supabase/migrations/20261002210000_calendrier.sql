-- =====================================================================
-- Abonnement au calendrier (Outlook, Google, Apple) : un lien secret par membre. Rejouable.
-- Seul le hachage SHA-256 du jeton est stocké ; le jeton n'est montré qu'une fois, à la création.
-- Table interne : ni temps réel, ni export.
-- =====================================================================

create table if not exists public.calendriers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  jeton_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.calendriers enable row level security;

drop trigger if exists calendriers_updated_at on public.calendriers;
create trigger calendriers_updated_at before update on public.calendriers
  for each row execute function public.maj_updated_at();

-- Lecture de son propre lien (date de création) ; écriture par les fonctions ci-dessous uniquement.
drop policy if exists calendriers_lecture on public.calendriers;
create policy calendriers_lecture on public.calendriers for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.generer_jeton_calendrier()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.est_membre() then
    raise exception 'Réservé aux membres.' using errcode = '42501';
  end if;
  insert into public.calendriers (user_id, jeton_hash)
  values (auth.uid(), encode(extensions.digest(v_jeton, 'sha256'), 'hex'))
  on conflict (user_id) do update set jeton_hash = excluded.jeton_hash, created_at = now();
  return v_jeton;
end;
$$;

create or replace function public.supprimer_jeton_calendrier()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.calendriers where user_id = auth.uid();
$$;

revoke all on function public.generer_jeton_calendrier() from public, anon;
revoke all on function public.supprimer_jeton_calendrier() from public, anon;
grant execute on function public.generer_jeton_calendrier() to authenticated;
grant execute on function public.supprimer_jeton_calendrier() to authenticated;

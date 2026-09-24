-- =====================================================================
-- Hub XTIM — schéma principal
-- Toutes les tables : id uuid, created_at, updated_at (trigger), RLS activée.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------
create or replace function public.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Membres (seuls les membres accèdent aux données)
-- ---------------------------------------------------------------------
create table public.membres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 80),
  email text,
  role text not null default 'membre' check (role in ('admin', 'membre')),
  derniere_ouverture_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.est_membre()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membres m where m.user_id = auth.uid());
$$;

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membres m where m.user_id = auth.uid() and m.role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table public.domaines (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (char_length(btrim(nom)) between 1 and 60),
  couleur text not null default '#5E6B78' check (couleur ~ '^#[0-9A-Fa-f]{6}$'),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projets (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (char_length(btrim(nom)) between 1 and 80),
  statut text not null default 'actif' check (statut in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tâches
-- ---------------------------------------------------------------------
create table public.taches (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(btrim(titre)) between 1 and 300),
  notes text not null default '' check (char_length(notes) <= 20000),
  domaine_id uuid references public.domaines (id) on delete restrict,
  projet_id uuid references public.projets (id) on delete set null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'en_attente', 'fait')),
  en_attente_de text check (en_attente_de is null or char_length(en_attente_de) <= 200),
  priorite text not null default 'normale' check (priorite in ('normale', 'urgente')),
  echeance date,
  assigne_a uuid references auth.users (id) on delete set null,
  cree_par uuid default auth.uid() references auth.users (id) on delete set null,
  done_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index taches_statut_idx on public.taches (statut) where deleted_at is null;
create index taches_echeance_idx on public.taches (echeance) where deleted_at is null;
create index taches_done_at_idx on public.taches (done_at);

-- Cohérence statut / done_at
create or replace function public.taches_done_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.statut = 'fait' and (tg_op = 'INSERT' or old.statut is distinct from 'fait') then
    new.done_at := coalesce(new.done_at, now());
  elsif new.statut <> 'fait' then
    new.done_at := null;
  end if;
  if new.statut <> 'en_attente' then
    new.en_attente_de := nullif(btrim(coalesce(new.en_attente_de, '')), '');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Post-its et rappels (privés par défaut)
-- ---------------------------------------------------------------------
create table public.postits (
  id uuid primary key default gen_random_uuid(),
  contenu text not null check (char_length(btrim(contenu)) between 1 and 5000),
  couleur text not null default 'sable' check (couleur in ('sable', 'sauge', 'ciel', 'lavande')),
  epingle boolean not null default false,
  rappel_at timestamptz,
  rappel_envoye boolean not null default false,
  partage boolean not null default false,
  proprietaire uuid not null default auth.uid() references auth.users (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index postits_rappel_idx on public.postits (rappel_at) where rappel_envoye = false and archived_at is null;

-- Un rappel re-programmé doit être renvoyé
create or replace function public.postits_rappel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.rappel_at is distinct from old.rappel_at then
    new.rappel_envoye := false;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Process (bibliothèque et passation) + versions
-- ---------------------------------------------------------------------
create table public.process (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(btrim(titre)) between 1 and 200),
  domaine_id uuid references public.domaines (id) on delete set null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'obsolete')),
  contenu jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  contenu_texte text not null default '',
  responsable text check (responsable is null or char_length(responsable) <= 120),
  cree_par uuid default auth.uid() references auth.users (id) on delete set null,
  modifie_par uuid default auth.uid() references auth.users (id) on delete set null,
  recherche tsvector generated always as (
    setweight(to_tsvector('french', coalesce(titre, '')), 'A')
    || setweight(to_tsvector('french', coalesce(contenu_texte, '')), 'B')
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index process_recherche_idx on public.process using gin (recherche);

create table public.process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.process (id) on delete cascade,
  titre text not null,
  contenu jsonb not null,
  auteur uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index process_versions_process_idx on public.process_versions (process_id, created_at desc);

-- Snapshot du contenu à chaque enregistrement
create or replace function public.process_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.contenu is distinct from old.contenu or new.titre is distinct from old.titre then
    insert into public.process_versions (process_id, titre, contenu, auteur)
    values (new.id, new.titre, new.contenu, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.process_modifie_par()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_par := coalesce(auth.uid(), new.modifie_par);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 1 and 255),
  storage_path text not null unique,
  mime text,
  taille bigint check (taille is null or taille >= 0),
  domaine_id uuid references public.domaines (id) on delete set null,
  projet_id uuid references public.projets (id) on delete set null,
  categorie text check (categorie is null or char_length(categorie) <= 60),
  resume text,
  infos_cles jsonb not null default '[]'::jsonb,
  taches_suggerees jsonb not null default '[]'::jsonb,
  epingle boolean not null default false,
  analyse_statut text not null default 'en_attente' check (analyse_statut in ('en_attente', 'ok', 'erreur')),
  analyse_message text,
  ajoute_par uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Suivi Chine (lecture seule du fichier Excel d'Edwin)
-- ---------------------------------------------------------------------
create table public.chine_source (
  id uuid primary key default gen_random_uuid(),
  ligne_unique boolean not null default true unique check (ligne_unique),
  share_url text check (share_url is null or share_url ~* '^https://'),
  drive_item_id text,
  last_sync_at timestamptz,
  last_hash text,
  last_error text,
  derniere_source text check (derniere_source is null or derniere_source in ('mock', 'onedrive')),
  mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chine_snapshots (
  id uuid primary key default gen_random_uuid(),
  taken_at timestamptz not null default now(),
  hash text not null,
  source text not null default 'onedrive' check (source in ('mock', 'onedrive')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chine_snapshots_taken_idx on public.chine_snapshots (taken_at desc);

-- ---------------------------------------------------------------------
-- Rapports
-- ---------------------------------------------------------------------
create table public.rapports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('demande', 'hebdo', 'mensuel')),
  periode_debut date not null,
  periode_fin date not null,
  filtres jsonb not null default '{}'::jsonb,
  donnees jsonb not null default '{}'::jsonb,
  synthese text,
  contenu_md text,
  genere_par uuid references auth.users (id) on delete set null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'pret', 'erreur')),
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periode_fin >= periode_debut)
);
create index rapports_created_idx on public.rapports (created_at desc);
-- Un seul rapport automatique par période (protège des doubles déclenchements pg_cron)
create unique index rapports_auto_unique on public.rapports (type, periode_debut, periode_fin)
  where type in ('hebdo', 'mensuel');

-- ---------------------------------------------------------------------
-- Paramètres (ligne unique, admin seulement)
-- ---------------------------------------------------------------------
create table public.parametres (
  id uuid primary key default gen_random_uuid(),
  ligne_unique boolean not null default true unique check (ligne_unique),
  modele_ia text not null default 'claude-sonnet-5' check (char_length(modele_ia) between 3 and 100),
  rapports_auto boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Journal d'activité (base du reporting par période)
-- ---------------------------------------------------------------------
create table public.journal_activite (
  id uuid primary key default gen_random_uuid(),
  entite text not null check (entite in ('taches', 'process', 'documents', 'postits')),
  entite_id uuid not null,
  action text not null check (action in ('cree', 'modifie', 'statut', 'supprime')),
  avant jsonb,
  apres jsonb,
  user_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_at_idx on public.journal_activite (at desc);
create index journal_entite_idx on public.journal_activite (entite, entite_id);

-- Résumé compact d'une ligne (évite de stocker les notes / contenus complets)
create or replace function public.resume_entite(p_table text, p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_table
    when 'taches' then jsonb_strip_nulls(jsonb_build_object(
      'titre', p_row->>'titre', 'statut', p_row->>'statut', 'priorite', p_row->>'priorite',
      'echeance', p_row->>'echeance', 'domaine_id', p_row->>'domaine_id', 'projet_id', p_row->>'projet_id',
      'assigne_a', p_row->>'assigne_a', 'en_attente_de', p_row->>'en_attente_de',
      'done_at', p_row->>'done_at', 'deleted_at', p_row->>'deleted_at'))
    when 'process' then jsonb_strip_nulls(jsonb_build_object(
      'titre', p_row->>'titre', 'statut', p_row->>'statut', 'domaine_id', p_row->>'domaine_id',
      'responsable', p_row->>'responsable', 'version', md5(coalesce(p_row->>'contenu', '')),
      'deleted_at', p_row->>'deleted_at'))
    when 'documents' then jsonb_strip_nulls(jsonb_build_object(
      'nom', p_row->>'nom', 'categorie', p_row->>'categorie', 'domaine_id', p_row->>'domaine_id',
      'projet_id', p_row->>'projet_id', 'epingle', p_row->>'epingle', 'deleted_at', p_row->>'deleted_at'))
    when 'postits' then jsonb_strip_nulls(jsonb_build_object(
      'contenu', left(p_row->>'contenu', 200), 'epingle', p_row->>'epingle', 'partage', p_row->>'partage',
      'rappel_at', p_row->>'rappel_at', 'archived_at', p_row->>'archived_at'))
    else '{}'::jsonb
  end;
$$;

create or replace function public.journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_avant jsonb;
  v_apres jsonb;
  v_action text;
begin
  -- Post-its : seuls les post-its partagés sont journalisés
  if tg_table_name = 'postits'
     and coalesce((v_old->>'partage')::boolean, false) = false
     and coalesce((v_new->>'partage')::boolean, false) = false then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_action := 'cree';
    v_apres := public.resume_entite(tg_table_name, v_new);
  elsif tg_op = 'DELETE' then
    v_action := 'supprime';
    v_avant := public.resume_entite(tg_table_name, v_old);
  else
    v_avant := public.resume_entite(tg_table_name, v_old);
    v_apres := public.resume_entite(tg_table_name, v_new);
    if v_avant = v_apres then
      return new; -- aucune modification significative
    end if;
    if v_new->>'deleted_at' is not null and v_old->>'deleted_at' is null then
      v_action := 'supprime';
    elsif v_new ? 'statut' and (v_new->>'statut') is distinct from (v_old->>'statut') then
      v_action := 'statut';
    else
      v_action := 'modifie';
    end if;
  end if;

  insert into public.journal_activite (entite, entite_id, action, avant, apres, user_id)
  values (tg_table_name, coalesce(v_new->>'id', v_old->>'id')::uuid, v_action, v_avant, v_apres, auth.uid());

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['membres', 'domaines', 'projets', 'taches', 'postits', 'process', 'process_versions',
                           'documents', 'chine_source', 'chine_snapshots', 'rapports', 'parametres', 'journal_activite']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.maj_updated_at()',
                   t || '_updated_at', t);
  end loop;
end;
$$;

create trigger taches_done_at before insert or update on public.taches
  for each row execute function public.taches_done_at();
create trigger postits_rappel before update on public.postits
  for each row execute function public.postits_rappel();
create trigger process_modifie_par before update on public.process
  for each row execute function public.process_modifie_par();
create trigger process_snapshot after insert or update on public.process
  for each row execute function public.process_snapshot();

create trigger taches_journal after insert or update or delete on public.taches
  for each row execute function public.journaliser();
create trigger process_journal after insert or update or delete on public.process
  for each row execute function public.journaliser();
create trigger documents_journal after insert or update or delete on public.documents
  for each row execute function public.journaliser();
create trigger postits_journal after insert or update or delete on public.postits
  for each row execute function public.journaliser();

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Enregistre l'ouverture de l'app et renvoie la précédente (« ce qui a changé depuis »)
create or replace function public.marquer_ouverture()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prec timestamptz;
begin
  select derniere_ouverture_at into v_prec from public.membres where user_id = auth.uid();
  update public.membres set derniere_ouverture_at = now() where user_id = auth.uid();
  return v_prec;
end;
$$;

-- Le membre modifie son propre nom
create or replace function public.renommer_moi(p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membres set nom = btrim(p_nom) where user_id = auth.uid();
end;
$$;

-- Premier lancement : aucun administrateur → le compte connecté peut le devenir
create or replace function public.premier_admin_possible()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and not exists (select 1 from public.membres where role = 'admin');
$$;

create or replace function public.devenir_premier_admin(p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from public.membres where role = 'admin') then
    raise exception 'Un administrateur existe déjà' using errcode = '42501';
  end if;
  insert into public.membres (user_id, nom, email, role)
  select u.id, btrim(p_nom), u.email, 'admin' from auth.users u where u.id = auth.uid()
  on conflict (user_id) do update set role = 'admin';
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d'accès (RLS)
-- ---------------------------------------------------------------------
alter table public.membres enable row level security;
alter table public.domaines enable row level security;
alter table public.projets enable row level security;
alter table public.taches enable row level security;
alter table public.postits enable row level security;
alter table public.process enable row level security;
alter table public.process_versions enable row level security;
alter table public.documents enable row level security;
alter table public.chine_source enable row level security;
alter table public.chine_snapshots enable row level security;
alter table public.rapports enable row level security;
alter table public.parametres enable row level security;
alter table public.journal_activite enable row level security;

-- membres
create policy membres_lecture on public.membres for select to authenticated using ((select public.est_membre()));
create policy membres_admin_ins on public.membres for insert to authenticated with check ((select public.est_admin()));
create policy membres_admin_maj on public.membres for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy membres_admin_sup on public.membres for delete to authenticated using ((select public.est_admin()) and user_id <> auth.uid());

-- domaines (structure : admin)
create policy domaines_lecture on public.domaines for select to authenticated using ((select public.est_membre()));
create policy domaines_admin_ins on public.domaines for insert to authenticated with check ((select public.est_admin()));
create policy domaines_admin_maj on public.domaines for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy domaines_admin_sup on public.domaines for delete to authenticated using ((select public.est_admin()));

-- projets (membres ; suppression admin)
create policy projets_lecture on public.projets for select to authenticated using ((select public.est_membre()));
create policy projets_ins on public.projets for insert to authenticated with check ((select public.est_membre()));
create policy projets_maj on public.projets for update to authenticated using ((select public.est_membre())) with check ((select public.est_membre()));
create policy projets_admin_sup on public.projets for delete to authenticated using ((select public.est_admin()));

-- taches (données partagées ; suppression = soft delete, suppression définitive admin)
create policy taches_lecture on public.taches for select to authenticated using ((select public.est_membre()));
create policy taches_ins on public.taches for insert to authenticated with check ((select public.est_membre()));
create policy taches_maj on public.taches for update to authenticated using ((select public.est_membre())) with check ((select public.est_membre()));
create policy taches_admin_sup on public.taches for delete to authenticated using ((select public.est_admin()));

-- postits (privés par défaut)
create policy postits_lecture on public.postits for select to authenticated
  using (proprietaire = (select auth.uid()) or (partage and (select public.est_membre())));
create policy postits_ins on public.postits for insert to authenticated
  with check (proprietaire = (select auth.uid()) and (select public.est_membre()));
create policy postits_maj on public.postits for update to authenticated
  using (proprietaire = (select auth.uid()) or (partage and (select public.est_membre())))
  with check (proprietaire = (select auth.uid()) or (partage and (select public.est_membre())));
create policy postits_sup on public.postits for delete to authenticated using (proprietaire = (select auth.uid()));

-- process
create policy process_lecture on public.process for select to authenticated using ((select public.est_membre()));
create policy process_ins on public.process for insert to authenticated with check ((select public.est_membre()));
create policy process_maj on public.process for update to authenticated using ((select public.est_membre())) with check ((select public.est_membre()));
create policy process_admin_sup on public.process for delete to authenticated using ((select public.est_admin()));
create policy process_versions_lecture on public.process_versions for select to authenticated using ((select public.est_membre()));

-- documents
create policy documents_lecture on public.documents for select to authenticated using ((select public.est_membre()));
create policy documents_ins on public.documents for insert to authenticated with check ((select public.est_membre()));
create policy documents_maj on public.documents for update to authenticated using ((select public.est_membre())) with check ((select public.est_membre()));
create policy documents_admin_sup on public.documents for delete to authenticated using ((select public.est_admin()));

-- Suivi Chine : lecture membres, configuration admin, snapshots écrits par la fonction (service role)
create policy chine_source_lecture on public.chine_source for select to authenticated using ((select public.est_membre()));
create policy chine_source_admin_maj on public.chine_source for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy chine_snapshots_lecture on public.chine_snapshots for select to authenticated using ((select public.est_membre()));

-- rapports (générés par la fonction ; suppression par l'auteur ou l'admin)
create policy rapports_lecture on public.rapports for select to authenticated using ((select public.est_membre()));
create policy rapports_sup on public.rapports for delete to authenticated
  using ((select public.est_admin()) or genere_par = (select auth.uid()));

-- paramètres
create policy parametres_lecture on public.parametres for select to authenticated using ((select public.est_membre()));
create policy parametres_admin_maj on public.parametres for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));

-- journal (lecture seule ; alimenté par triggers)
create policy journal_lecture on public.journal_activite for select to authenticated using ((select public.est_membre()));

-- Droits SQL explicites (anon n'a accès à rien)
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Temps réel
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.taches, public.postits, public.process, public.documents, public.domaines, public.projets,
  public.membres, public.chine_source, public.chine_snapshots, public.rapports, public.parametres,
  public.journal_activite;

-- ---------------------------------------------------------------------
-- Stockage des documents (bucket privé)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy documents_fichiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.est_membre()));
create policy documents_fichiers_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.est_membre()));
create policy documents_fichiers_maj on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (select public.est_membre()));
create policy documents_fichiers_sup on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select public.est_admin()));

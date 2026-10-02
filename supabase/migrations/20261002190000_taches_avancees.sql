-- =====================================================================
-- Tâches : récurrence, sous-tâches (checklist), commentaires et @mentions. Rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Récurrence
-- recurrence = { frequence: jour|semaine|mois|annee, intervalle?: 1..12, jours_semaine?: [1..7],
--                jour_mois?: 1..31, jusqu_au?: 'AAAA-MM-JJ' }
-- Quand une tâche récurrente passe à « fait », l'occurrence suivante est créée par trigger
-- (même calcul que _shared/logic/recurrence.ts).
-- ---------------------------------------------------------------------
alter table public.taches add column if not exists recurrence jsonb;
alter table public.taches add column if not exists serie_id uuid;
alter table public.taches add column if not exists suite_de uuid references public.taches (id) on delete set null;
create index if not exists taches_serie_idx on public.taches (serie_id) where serie_id is not null;
create index if not exists taches_suite_idx on public.taches (suite_de) where suite_de is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'taches_recurrence_check') then
    alter table public.taches add constraint taches_recurrence_check check (
      recurrence is null or (
        jsonb_typeof(recurrence) = 'object'
        and recurrence ->> 'frequence' in ('jour', 'semaine', 'mois', 'annee')
        and (recurrence -> 'intervalle' is null
             or (jsonb_typeof(recurrence -> 'intervalle') = 'number'
                 and (recurrence ->> 'intervalle')::numeric between 1 and 12))
        and (recurrence -> 'jours_semaine' is null or jsonb_typeof(recurrence -> 'jours_semaine') = 'array')
        and (recurrence -> 'jour_mois' is null
             or (jsonb_typeof(recurrence -> 'jour_mois') = 'number'
                 and (recurrence ->> 'jour_mois')::numeric between 1 and 31))
        and (recurrence -> 'jusqu_au' is null or jsonb_typeof(recurrence -> 'jusqu_au') in ('string', 'null'))
      )
    );
  end if;
end;
$$;

create or replace function public.prochaine_echeance(p_base date, p_regle jsonb)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n int := least(greatest(coalesce(round((p_regle ->> 'intervalle')::numeric)::int, 1), 1), 12);
  v_jours int[];
  v_jour int;
  v_d date;
  v_mois date;
  v_suivante date;
  i int := 0;
begin
  case p_regle ->> 'frequence'
    when 'jour' then
      v_suivante := p_base + v_n;
    when 'semaine' then
      select coalesce(array_agg(x::int), '{}') into v_jours
      from jsonb_array_elements_text(coalesce(p_regle -> 'jours_semaine', '[]'::jsonb)) as x
      where x ~ '^[1-7]$';
      if cardinality(v_jours) = 0 then
        v_suivante := p_base + 7 * v_n;
      else
        -- Jour suivant de la liste ; en passant le dimanche, on saute (n - 1) semaines.
        v_d := p_base + 1;
        while not (extract(isodow from v_d)::int = any (v_jours)) and i < 400 loop
          if extract(isodow from v_d) = 7 then
            v_d := v_d + 1 + 7 * (v_n - 1);
          else
            v_d := v_d + 1;
          end if;
          i := i + 1;
        end loop;
        v_suivante := v_d;
      end if;
    when 'mois' then
      v_jour := coalesce(round((p_regle ->> 'jour_mois')::numeric)::int, extract(day from p_base)::int);
      v_mois := (date_trunc('month', p_base) + make_interval(months => v_n))::date;
      v_suivante := v_mois + (least(v_jour, extract(day from (v_mois + interval '1 month - 1 day'))::int) - 1);
    when 'annee' then
      v_suivante := (p_base + make_interval(years => v_n))::date;
    else
      return null;
  end case;
  if nullif(p_regle ->> 'jusqu_au', '') is not null and v_suivante > (p_regle ->> 'jusqu_au')::date then
    return null;
  end if;
  return v_suivante;
end;
$$;

-- La série porte l'identifiant de sa première tâche.
create or replace function public.taches_serie()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recurrence is not null and new.serie_id is null then
    new.serie_id := new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists taches_serie on public.taches;
create trigger taches_serie before insert or update on public.taches
  for each row execute function public.taches_serie();

create or replace function public.taches_occurrence_suivante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_echeance date;
begin
  -- Rouverte juste après (« Annuler ») : l'occurrence créée et jamais modifiée disparaît.
  if old.statut = 'fait' and new.statut <> 'fait' then
    update public.taches set deleted_at = now()
    where suite_de = new.id and statut = 'a_faire' and deleted_at is null and updated_at = created_at;
    return new;
  end if;
  if new.recurrence is null or new.statut <> 'fait' or old.statut = 'fait' or new.deleted_at is not null then
    return new;
  end if;
  -- Une occurrence encore ouverte existe déjà dans la série : rien à créer.
  if exists (
    select 1 from public.taches t
    where t.id <> new.id and t.deleted_at is null and t.statut <> 'fait'
      and (t.serie_id = new.serie_id or t.suite_de = new.id)
  ) then
    return new;
  end if;
  v_echeance := public.prochaine_echeance(coalesce(new.echeance, (now() at time zone 'Europe/Paris')::date), new.recurrence);
  if v_echeance is null then
    return new;
  end if;
  insert into public.taches (titre, notes, domaine_id, projet_id, priorite, assigne_a, cree_par, echeance,
                             recurrence, serie_id, suite_de, statut)
  values (new.titre, '', new.domaine_id, new.projet_id, new.priorite, new.assigne_a, new.cree_par, v_echeance,
          new.recurrence, new.serie_id, new.id, 'a_faire')
  returning id into v_id;
  insert into public.sous_taches (tache_id, titre, fait, ordre)
  select v_id, titre, false, ordre from public.sous_taches where tache_id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Sous-tâches (checklist d'une tâche)
-- ---------------------------------------------------------------------
create table if not exists public.sous_taches (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references public.taches (id) on delete cascade,
  titre text not null check (char_length(btrim(titre)) between 1 and 300),
  fait boolean not null default false,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sous_taches_tache_idx on public.sous_taches (tache_id, ordre);
alter table public.sous_taches enable row level security;

drop trigger if exists sous_taches_updated_at on public.sous_taches;
create trigger sous_taches_updated_at before update on public.sous_taches
  for each row execute function public.maj_updated_at();

drop policy if exists sous_taches_lecture on public.sous_taches;
drop policy if exists sous_taches_ins on public.sous_taches;
drop policy if exists sous_taches_maj on public.sous_taches;
drop policy if exists sous_taches_sup on public.sous_taches;
create policy sous_taches_lecture on public.sous_taches for select to authenticated using ((select public.est_membre()));
create policy sous_taches_ins on public.sous_taches for insert to authenticated with check ((select public.est_membre()));
create policy sous_taches_maj on public.sous_taches for update to authenticated
  using ((select public.est_membre())) with check ((select public.est_membre()));
create policy sous_taches_sup on public.sous_taches for delete to authenticated using ((select public.est_membre()));

-- Le trigger d'occurrence suivante copie les sous-tâches : il est créé après la table.
drop trigger if exists taches_occurrence_suivante on public.taches;
create trigger taches_occurrence_suivante after update of statut on public.taches
  for each row execute function public.taches_occurrence_suivante();

-- ---------------------------------------------------------------------
-- Commentaires et @mentions
-- ---------------------------------------------------------------------
create table if not exists public.commentaires (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references public.taches (id) on delete cascade,
  auteur uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contenu text not null check (char_length(btrim(contenu)) between 1 and 5000),
  mentions uuid[] not null default '{}',
  modifie_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commentaires_tache_idx on public.commentaires (tache_id, created_at);
create index if not exists commentaires_mentions_idx on public.commentaires using gin (mentions);
alter table public.commentaires enable row level security;

drop trigger if exists commentaires_updated_at on public.commentaires;
create trigger commentaires_updated_at before update on public.commentaires
  for each row execute function public.maj_updated_at();

drop policy if exists commentaires_lecture on public.commentaires;
drop policy if exists commentaires_ins on public.commentaires;
drop policy if exists commentaires_maj on public.commentaires;
create policy commentaires_lecture on public.commentaires for select to authenticated using ((select public.est_membre()));
create policy commentaires_ins on public.commentaires for insert to authenticated
  with check ((select public.est_membre()) and auteur = (select auth.uid()));
-- Modification et suppression (douce) par l'auteur seulement
create policy commentaires_maj on public.commentaires for update to authenticated
  using (auteur = (select auth.uid())) with check (auteur = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Droits et temps réel
-- ---------------------------------------------------------------------
revoke execute on function public.prochaine_echeance(date, jsonb) from public, anon;
revoke execute on function public.taches_serie() from public, anon, authenticated;
revoke execute on function public.taches_occurrence_suivante() from public, anon, authenticated;
grant execute on function public.prochaine_echeance(date, jsonb) to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['sous_taches', 'commentaires'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

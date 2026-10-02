-- =====================================================================
-- Santé des process (passation) : révision périodique et exécutions. Rejouable.
-- - process.revision_mois : à revoir tous les N mois (6 par défaut) ;
-- - process.revise_le     : dernière revue explicite (« Marquer comme revu ») ;
-- - taches.process_id     : tâche créée par « Exécuter ce process » (historique des exécutions).
-- =====================================================================

alter table public.process add column if not exists revision_mois integer not null default 6;
alter table public.process add column if not exists revise_le date;
alter table public.taches add column if not exists process_id uuid references public.process (id) on delete set null;
create index if not exists taches_process_idx on public.taches (process_id) where process_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'process_revision_mois_check') then
    alter table public.process add constraint process_revision_mois_check check (revision_mois between 1 and 36);
  end if;
end;
$$;

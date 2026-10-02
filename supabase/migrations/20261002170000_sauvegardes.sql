-- =====================================================================
-- Sauvegarde automatique hebdomadaire (rejouable)
-- La fonction « sauvegarde » dépose chaque dimanche un zip de toutes les tables dans le bucket
-- privé « sauvegardes » (8 dernières conservées). Lecture réservée à l'administrateur ; seules
-- les fonctions (service role) écrivent.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('sauvegardes', 'sauvegardes', false, 104857600)
on conflict (id) do nothing;

drop policy if exists sauvegardes_lecture on storage.objects;
create policy sauvegardes_lecture on storage.objects for select to authenticated
  using (bucket_id = 'sauvegardes' and (select public.est_admin()));

-- Dimanche 1 h UTC (3 h l'été, 2 h l'hiver à Paris)
select cron.schedule('hubx-sauvegarde', '0 1 * * 0', $$select public.appeler_fonction('sauvegarde')$$);

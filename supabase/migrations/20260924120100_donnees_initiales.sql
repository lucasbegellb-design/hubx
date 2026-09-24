-- Données de référence nécessaires en production (idempotent)
insert into public.domaines (nom, couleur, ordre) values
  ('Commercial', '#2F5D7C', 1),
  ('Admin', '#5E6B78', 2),
  ('Compta', '#2E7D4F', 3),
  ('RH', '#8A5A83', 4),
  ('Produit', '#B54708', 5),
  ('Production', '#6B5B3E', 6)
on conflict (nom) do nothing;

insert into public.projets (nom, statut) values ('Swift', 'actif')
on conflict (nom) do nothing;

insert into public.chine_source (ligne_unique) values (true) on conflict (ligne_unique) do nothing;
insert into public.parametres (ligne_unique) values (true) on conflict (ligne_unique) do nothing;

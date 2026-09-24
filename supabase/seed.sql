-- =====================================================================
-- Données de DÉMONSTRATION pour le développement local uniquement
-- (`npx supabase db reset`). Ne pas exécuter en production.
-- Comptes : lucas@xtim.test / edwin@xtim.test — mot de passe : xtim-demo-2026
-- =====================================================================

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'lucas@xtim.test', extensions.crypt('xtim-demo-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'edwin@xtim.test', extensions.crypt('xtim-demo-2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"lucas@xtim.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"edwin@xtim.test"}', 'email', now(), now(), now());

insert into public.membres (user_id, nom, email, role) values
  ('11111111-1111-4111-8111-111111111111', 'Lucas', 'lucas@xtim.test', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'Edwin', 'edwin@xtim.test', 'membre');

-- Tâches (dates relatives à aujourd'hui)
with d as (select id, nom from public.domaines), p as (select id from public.projets where nom = 'Swift')
insert into public.taches (titre, notes, domaine_id, projet_id, statut, en_attente_de, priorite, echeance, assigne_a, cree_par, done_at)
values
  ('Relancer le distributeur allemand pour la commande de printemps', '', (select id from d where nom = 'Commercial'), null,
   'a_faire', null, 'urgente', current_date - 2, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null),
  ('Déclaration de TVA mensuelle', 'Récupérer les relevés bancaires avant.', (select id from d where nom = 'Compta'), null,
   'a_faire', null, 'normale', current_date, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null),
  ('Valider les échantillons d''ailes Swift', '', (select id from d where nom = 'Produit'), (select id from p),
   'en_attente', 'Retour usine de Shenzhen', 'normale', current_date + 3, '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', null),
  ('Mettre à jour la fiche produit Bionic Bird sur le site', '', (select id from d where nom = 'Commercial'), null,
   'en_cours', null, 'normale', current_date + 5, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null),
  ('Préparer l''entretien annuel de l''alternant', '', (select id from d where nom = 'RH'), null,
   'a_faire', null, 'normale', current_date + 12, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null),
  ('Planifier la production du lot de novembre', '', (select id from d where nom = 'Production'), (select id from p),
   'a_faire', null, 'urgente', current_date + 1, '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', null),
  ('Renouveler l''assurance responsabilité civile produit', '', (select id from d where nom = 'Admin'), null,
   'a_faire', null, 'normale', null, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', null),
  ('Envoyer les factures du salon de Nuremberg', '', (select id from d where nom = 'Compta'), null,
   'fait', null, 'normale', current_date - 1, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', now() - interval '1 day'),
  ('Répondre au questionnaire douane du transitaire', '', (select id from d where nom = 'Admin'), null,
   'fait', null, 'normale', null, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', now() - interval '3 hours');

-- Post-its
insert into public.postits (contenu, couleur, epingle, rappel_at, partage, proprietaire) values
  ('Appeler la banque pour le plafond de virement international', 'sable', true, now() + interval '2 hours', false,
   '11111111-1111-4111-8111-111111111111'),
  ('Idée : pack cadeau Noël avec batterie supplémentaire', 'sauge', false, null, true, '22222222-2222-4222-8222-222222222222'),
  ('Code Wi-Fi atelier : voir tiroir du haut', 'ciel', false, null, false, '11111111-1111-4111-8111-111111111111');

-- Process (modèle XTIM)
insert into public.process (titre, domaine_id, statut, responsable, contenu, contenu_texte, cree_par, modifie_par)
values (
  'Paiement d''un fournisseur chinois',
  (select id from public.domaines where nom = 'Compta'),
  'actif',
  'Lucas',
  '{"type":"doc","content":[
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objectif"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Payer un acompte ou un solde de PO à un fournisseur en Chine, sans erreur de devise ni de bénéficiaire."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Déclencheur"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Facture proforma reçue, ou échéance de solde dans le suivi Chine."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Responsable"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Lucas (validation Edwin au-delà de 10 000 USD)."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Outils et fichiers"}]},
    {"type":"bulletList","content":[
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Banque en ligne (virement SWIFT)"}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Fichier de suivi Chine (OneDrive d''Edwin)"}]}]}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Étapes"}]},
    {"type":"orderedList","content":[
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vérifier le montant et la devise sur la proforma."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Contrôler les coordonnées bancaires avec la fiche fournisseur."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Saisir le virement et envoyer la preuve au fournisseur."}]}]}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Points d''attention"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Toute modification de RIB annoncée par e-mail doit être confirmée par téléphone (fraude au président)."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Dernière révision"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Septembre 2026 — Lucas"}]}
  ]}'::jsonb,
  'Objectif Payer un acompte ou un solde de PO à un fournisseur en Chine. Déclencheur Facture proforma reçue. Responsable Lucas. Étapes Vérifier le montant et la devise. Contrôler les coordonnées bancaires. Saisir le virement. Points d''attention modification de RIB fraude.',
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'
);

-- =====================================================================
-- v20.297 — Stockage « bons-bio » : accepter les PDF (bons et factures)
-- =====================================================================
-- Constat (Phil, 27/10/2026) : joindre un bon de livraison en PDF répond
-- « new row violates row-level security policy » : la règle du dossier
-- bons-bio (créée dans le tableau de bord Supabase) n'accepte que les images.
-- Les règles sont cumulatives : on en AJOUTE une pour les PDF, sans toucher
-- à l'existante. Et on s'assure que le dossier lui-même ne bloque pas le type.
--
-- 1) Lancer ce script dans SQL Editor. 2) Réessayer la saisie avec le PDF.
-- =====================================================================

-- Le dossier : si une liste de types autorisés existe, on y ajoute le PDF
update storage.buckets
   set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
 where id = 'bons-bio' and allowed_mime_types is not null
   and not ('application/pdf' = any(allowed_mime_types));

-- Les règles : envoi et lecture des PDF du dossier bons-bio
drop policy if exists "bons-bio pdf envoi" on storage.objects;
create policy "bons-bio pdf envoi" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'bons-bio' and lower(storage.extension(name)) = 'pdf');

drop policy if exists "bons-bio pdf lecture" on storage.objects;
create policy "bons-bio pdf lecture" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'bons-bio' and lower(storage.extension(name)) = 'pdf');

-- Vérification : les règles du stockage (pour comprendre celle qui refusait)
select policyname, cmd, roles, with_check
  from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;

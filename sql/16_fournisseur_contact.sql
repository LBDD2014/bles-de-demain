-- Migration 16 : coordonnées des fournisseurs (téléphone, email, adresse)
alter table fab_fournisseurs add column if not exists telephone text;
alter table fab_fournisseurs add column if not exists email text;
alter table fab_fournisseurs add column if not exists adresse text;

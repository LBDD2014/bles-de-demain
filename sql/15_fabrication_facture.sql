-- ============================================================================
-- LBDD — Module FABRICATION / TRAÇABILITÉ BIO
-- Migration 15 : photo de la facture sur les livraisons (en plus du bon)
-- ----------------------------------------------------------------------------
-- BV contrôle factures ET bons de livraison. On stockait déjà la photo du bon
-- (photo_url) ; on ajoute la photo de la facture (optionnelle).
-- ============================================================================

alter table fab_livraisons add column if not exists photo_facture_url text;

-- Upload depuis l'app (bucket Storage 'bons-bio'), champ « 🧾 Photo de la facture ».
-- ============================================================================

-- ============================================================
-- v20.84 — Messagerie inter-équipes : étend livreur_messages
-- À lancer AVANT le push du front (sinon l'app plante en prod).
-- ============================================================

-- 1. Nouvelles colonnes (idempotent)
ALTER TABLE livreur_messages
  ADD COLUMN IF NOT EXISTS recipient_boutique TEXT,
  ADD COLUMN IF NOT EXISTS sender_name        TEXT,
  ADD COLUMN IF NOT EXISTS msg_date           DATE;

-- 2. Backfill des anciens messages : ils allaient tous au livreur
UPDATE livreur_messages
   SET recipient_boutique = 'livreur'
 WHERE recipient_boutique IS NULL;

UPDATE livreur_messages
   SET msg_date = created_at::date
 WHERE msg_date IS NULL;

-- 3. Index pour le chargement par boîte (reçus + envoyés)
CREATE INDEX IF NOT EXISTS idx_lm_recipient ON livreur_messages (tenant_id, recipient_boutique, msg_date);
CREATE INDEX IF NOT EXISTS idx_lm_sender    ON livreur_messages (tenant_id, sender_boutique, msg_date);

-- Note RLS : l'app utilise la clé anon, qui a déjà select/insert/update/delete
-- sur livreur_messages (système livreur existant). Aucune nouvelle policy requise.

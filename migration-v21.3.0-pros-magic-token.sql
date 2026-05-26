-- =====================================================================
-- v21.3.0 — Magic link interface pro : colonne magic_token sur pros
-- =====================================================================
-- Chaque pro peut avoir un token aléatoire 32 chars stocké ici. Quand Phil
-- partage l'URL https://.../?pro_token=<token>, l'app reconnaît le pro et
-- affiche son interface dédiée (saisie commandes sans login).
--
-- Le token est NULL par défaut. Phil le génère/renouvelle via un bouton
-- "🔗 Générer magic link" dans BackOffice fiche pro.
--
-- Sécurité : token = secret. Si compromis, régénérer (le pro reçoit alors
-- une nouvelle URL et l'ancienne ne marche plus).
-- =====================================================================

ALTER TABLE public.pros
  ADD COLUMN IF NOT EXISTS magic_token text;

-- Unique pour permettre le lookup sans collision (et UPSERT safe)
DO $$ BEGIN
  ALTER TABLE public.pros
    ADD CONSTRAINT pros_magic_token_unique UNIQUE (magic_token);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index pour lookup rapide (le WHERE magic_token = ? est l'op principale)
CREATE INDEX IF NOT EXISTS idx_pros_magic_token ON public.pros(magic_token)
  WHERE magic_token IS NOT NULL;

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='pros' AND column_name='magic_token';

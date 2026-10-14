-- v20.279 — Onglet Fêtes : la vue Production (Local / Veigné) se recharge en direct quand une
-- boutique ajoute ou modifie une commande ou sa note. Pour ça, la table fete_orders doit être
-- dans la publication Realtime (comme special_orders, pros…).
-- À exécuter une fois dans Supabase → SQL Editor. Sans ça, l'app marche quand même :
-- la vue Production se met à jour à l'ouverture de l'onglet, mais pas en direct.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fete_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fete_orders;
  END IF;
END $$;

-- Vérification (facultatif) :
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fete_orders';

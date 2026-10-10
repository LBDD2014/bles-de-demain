-- v20.272 — « 📱 Liens pros » (Phil, 10/10/2026) : tous les liens d'accès des pros sur un écran,
-- envoi WhatsApp en un tap, et l'app RETIENT la date d'envoi pour ne pas renvoyer deux fois.
--   pros.magic_sent_at = dernier envoi (WhatsApp ou copie du lien) ; null = jamais envoyé.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.272
-- (sans la colonne, l'écran marche mais n'enregistre pas la date : avertissement orange).

alter table public.pros add column if not exists magic_sent_at timestamptz;

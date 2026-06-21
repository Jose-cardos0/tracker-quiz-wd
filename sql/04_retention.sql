-- ============================================================================
--  OPCIONAL — Retenção de dados (GDPR). Roda diariamente e apaga eventos
--  crus com mais de N dias. As tabelas agregadas (sessions/visitors) ficam.
--  Requer a extensão pg_cron (Supabase: Database -> Extensions -> pg_cron).
-- ============================================================================

-- create extension if not exists pg_cron;

-- Apaga eventos crus com mais de 180 dias, todo dia às 03:00.
-- select cron.schedule(
--   'purge-old-events',
--   '0 3 * * *',
--   $$ delete from events where created_at < now() - interval '180 days'; $$
-- );

-- Para rodar manualmente uma vez:
-- delete from events where created_at < now() - interval '180 days';

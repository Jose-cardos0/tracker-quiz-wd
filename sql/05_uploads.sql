-- ============================================================================
--  Migration para uploads via dashboard. Rode UMA vez no SQL Editor.
--  (additivo — não apaga nada)
-- ============================================================================

-- 'repo'    = servido de public/quizzes/<slug>/ (ex.: healthmeai, no código)
-- 'storage' = enviado pelo dashboard, servido de /q/<slug>/ (Supabase Storage)
alter table projects
  add column if not exists hosting text not null default 'repo';

alter table projects
  add column if not exists updated_at timestamptz not null default now();

-- Bucket público para os quizzes enviados pelo dashboard.
-- (o código também tenta criar via API; isto é garantia/idempotente)
insert into storage.buckets (id, name, public)
values ('quizzes', 'quizzes', true)
on conflict (id) do update set public = true;

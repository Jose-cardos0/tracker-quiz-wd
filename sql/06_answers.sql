-- ============================================================================
--  Respostas do lead (deduplicadas) — a "resposta atual" por pergunta.
--  Os eventos crus continuam em `events` (histórico append-only do vai-e-volta);
--  esta tabela guarda apenas o ESTADO ATUAL: 1 linha por (sessão, pergunta),
--  sobrescrita via UPSERT a cada nova resposta.
--
--  Rodar uma vez no SQL Editor do Supabase, depois de 01..05.
-- ============================================================================

create table if not exists answers (
  session_id  uuid not null,
  project_id  uuid,
  visitor_id  uuid,
  step_index  int,                  -- etapa onde a pergunta apareceu (contexto)
  question    text not null,        -- identidade da pergunta (ex: 'idade', 'motivacao')
  value       jsonb,                -- "Mann" | 92 | ["A","C"] | "texto livre"
  kind        text,                 -- 'single' | 'multi' | 'text' (informativo)
  answered_at timestamptz not null default now(),  -- ts do evento (anti-ordem-trocada)
  updated_at  timestamptz not null default now(),
  primary key (session_id, question)
);

-- leitura por projeto/pergunta (futuro: "respostas mais escolhidas") e por lead
create index if not exists answers_project_q_idx on answers (project_id, question);
create index if not exists answers_visitor_idx   on answers (visitor_id);

-- RLS: trancado; o app lê/escreve com a service-role key (bypassa RLS), igual
-- às demais tabelas.
alter table answers enable row level security;

-- ----------------------------------------------------------------------------
--  apply_answers: aplica um lote de respostas, fazendo UPSERT por (sessão,
--  pergunta). Se a resposta mudou (B -> C), a linha é sobrescrita. A guarda
--  `answered_at >= ...` evita que um lote atrasado (fora de ordem) sobrescreva
--  uma resposta mais nova. Chamada por /api/collect.
--
--  p_answers: jsonb array de
--    { "question": text, "value": <any>, "step_index": int|null,
--      "kind": text|null, "answered_at": iso-timestamp }
-- ----------------------------------------------------------------------------
create or replace function apply_answers(
  p_session  uuid,
  p_project  uuid,
  p_visitor  uuid,
  p_answers  jsonb
) returns void
language plpgsql as $$
declare
  a jsonb;
begin
  for a in
    select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    if coalesce(a->>'question', '') = '' then
      continue;  -- ignora respostas sem pergunta
    end if;

    insert into answers (
      session_id, project_id, visitor_id, step_index,
      question, value, kind, answered_at, updated_at
    ) values (
      p_session, p_project, p_visitor,
      nullif(a->>'step_index', '')::int,
      a->>'question',
      a->'value',
      a->>'kind',
      coalesce((a->>'answered_at')::timestamptz, now()),
      now()
    )
    on conflict (session_id, question) do update
      set value       = excluded.value,
          step_index  = coalesce(excluded.step_index, answers.step_index),
          kind        = coalesce(excluded.kind, answers.kind),
          answered_at = excluded.answered_at,
          updated_at  = now()
      where excluded.answered_at >= answers.answered_at;
  end loop;
end;
$$;

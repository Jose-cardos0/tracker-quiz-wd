-- ============================================================================
--  Estatísticas de respostas (base do leadscore — parte "a").
--  Lê a tabela `answers` (estado atual: 1 linha por sessão+pergunta) e agrega
--  por pergunta/valor. Tudo read-only / STABLE, chamado com a service-role key.
--
--  Janela de tempo: junta com `sessions` e filtra por started_at, igual às
--  demais agregações do dashboard (mesma população no numerador/denominador).
--
--  Rodar uma vez no SQL Editor do Supabase, depois de 06_answers.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Distribuição: por pergunta, quantas vezes cada VALOR foi escolhido.
--  Respostas múltiplas (value = array) contam cada item individualmente.
--  Respostas escalares (string / número) contam como 1. Texto livre também
--  aparece (cada texto distinto vira uma "barra" — útil pra ver o que mais
--  escrevem).
-- ----------------------------------------------------------------------------
create or replace function project_answer_stats(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  question    text,
  step_index  int,
  kind        text,
  value_label text,
  responses   bigint
)
language sql stable as $$
  with a as (
    select an.question, an.step_index, an.kind, an.value
    from answers an
    join sessions s on s.session_id = an.session_id
    where an.project_id = p_id
      and s.started_at >= p_from and s.started_at < p_to
  ),
  vals as (
    -- arrays (multi-resposta): uma linha por item selecionado
    select question, step_index, kind, elem #>> '{}' as value_label
    from a, lateral jsonb_array_elements(a.value) elem
    where jsonb_typeof(a.value) = 'array'
    union all
    -- escalares (single / texto livre / número): uma linha
    select question, step_index, kind, a.value #>> '{}' as value_label
    from a
    where jsonb_typeof(a.value) is distinct from 'array' and a.value is not null
  )
  select question,
         min(step_index) as step_index,
         min(kind)       as kind,
         value_label,
         count(*)        as responses
  from vals
  where coalesce(value_label, '') <> ''
  group by question, value_label
  order by question, responses desc;
$$;

-- ----------------------------------------------------------------------------
--  Resumo por pergunta: etapa, tipo e quantas SESSÕES distintas responderam.
--  O front cruza `sessions` (respondeu) com o funil (alcançou a etapa) para a
--  taxa de resposta = respondeu ÷ alcançou.
-- ----------------------------------------------------------------------------
create or replace function project_answer_questions(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  question   text,
  step_index int,
  kind       text,
  sessions   bigint
)
language sql stable as $$
  select an.question,
         min(an.step_index)          as step_index,
         min(an.kind)                as kind,
         count(distinct an.session_id) as sessions
  from answers an
  join sessions s on s.session_id = an.session_id
  where an.project_id = p_id
    and s.started_at >= p_from and s.started_at < p_to
  group by an.question
  order by min(an.step_index) nulls last, an.question;
$$;

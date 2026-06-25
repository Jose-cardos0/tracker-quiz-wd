-- ============================================================================
--  Análises detalhadas (Fase 1) — agregações para a tela "Análises detalhadas"
--  dentro do Leadscore. Tudo read-only / STABLE, chamado com a service-role key.
--
--  Janela de tempo: junta com `sessions` e filtra por started_at (mesma
--  população do resto do dashboard).
--
--  Rodar uma vez no SQL Editor do Supabase, depois de 06_answers.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  #1 Conclusão por resposta: entre quem ESCOLHEU cada valor, quantos
--  concluíram o quiz. Comparar valores DENTRO de uma mesma pergunta (comparar
--  entre perguntas de profundidades diferentes é enviesado por sobrevivência).
--  Multi-resposta conta cada item; o front compara com a taxa de conclusão
--  geral do funil (baseline).
-- ----------------------------------------------------------------------------
create or replace function project_answer_completion(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  question    text,
  step_index  int,
  value_label text,
  sessions    bigint,
  completed   bigint
)
language sql stable as $$
  with a as (
    select an.question, an.step_index, an.value, an.session_id, s.completed
    from answers an
    join sessions s on s.session_id = an.session_id
    where an.project_id = p_id
      and s.started_at >= p_from and s.started_at < p_to
  ),
  vals as (
    select question, step_index, elem #>> '{}' as value_label, session_id, completed
    from a, lateral jsonb_array_elements(a.value) elem
    where jsonb_typeof(a.value) = 'array'
    union all
    select question, step_index, a.value #>> '{}' as value_label, session_id, completed
    from a
    where jsonb_typeof(a.value) is distinct from 'array' and a.value is not null
  )
  select question,
         min(step_index)                                          as step_index,
         value_label,
         count(distinct session_id)                               as sessions,
         count(distinct session_id) filter (where completed)      as completed
  from vals
  where coalesce(value_label, '') <> ''
  group by question, value_label
  order by question, sessions desc;
$$;

-- ----------------------------------------------------------------------------
--  #3 Perfil numérico: estatísticas das respostas numéricas (peso, altura,
--  idade, meta...). Detecta sozinho quais perguntas são numéricas
--  (jsonb_typeof = 'number') — genérico, serve para qualquer funil.
-- ----------------------------------------------------------------------------
create or replace function project_numeric_stats(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  question    text,
  step_index  int,
  n           bigint,
  avg         numeric,
  median      numeric,
  p25         numeric,
  p75         numeric,
  min_val     numeric,
  max_val     numeric
)
language sql stable as $$
  with a as (
    select an.question, an.step_index, (an.value #>> '{}')::numeric as num
    from answers an
    join sessions s on s.session_id = an.session_id
    where an.project_id = p_id
      and s.started_at >= p_from and s.started_at < p_to
      and jsonb_typeof(an.value) = 'number'
  )
  select question,
         min(step_index)                                          as step_index,
         count(*)                                                 as n,
         round(avg(num), 1)                                       as avg,
         percentile_cont(0.5)  within group (order by num)        as median,
         percentile_cont(0.25) within group (order by num)        as p25,
         percentile_cont(0.75) within group (order by num)        as p75,
         min(num)                                                 as min_val,
         max(num)                                                 as max_val
  from a
  group by question
  having count(*) > 0
  order by min(step_index) nulls last, question;
$$;

-- ============================================================================
--  Análises detalhadas (Fase 2) — Associação entre respostas ("tende a X").
--  Para cada par de respostas de perguntas DIFERENTES que aparecem na mesma
--  sessão, calcula:
--    both        = sessões que marcaram A e B
--    confidence  = P(B|A) = both / total(A)   ("quem marcou A, % que marca B")
--    lift        = both * N / (total(A) * total(B))
--                  >1 => aparecem juntos MAIS que o acaso (associação positiva)
--
--  Read-only / STABLE. Janela via join com sessions.started_at. p_min_support
--  corta pares raros (ruído). Limite de 80 pares por lift desc.
--
--  Rodar uma vez no SQL Editor do Supabase, depois de 06_answers.sql.
-- ============================================================================
create or replace function project_answer_assoc(
  p_id uuid, p_from timestamptz, p_to timestamptz, p_min_support int default 3
)
returns table (
  q_a        text,
  v_a        text,
  q_b        text,
  v_b        text,
  both_cnt   bigint,
  a_total    bigint,
  b_total    bigint,
  confidence numeric,
  lift       numeric
)
language sql stable as $$
  with a as (
    select an.question, an.value, an.session_id
    from answers an
    join sessions s on s.session_id = an.session_id
    where an.project_id = p_id
      and s.started_at >= p_from and s.started_at < p_to
  ),
  sv as (
    select distinct session_id, question, elem #>> '{}' as value_label
    from a, lateral jsonb_array_elements(a.value) elem
    where jsonb_typeof(a.value) = 'array'
    union
    select distinct session_id, question, a.value #>> '{}' as value_label
    from a
    where jsonb_typeof(a.value) is distinct from 'array' and a.value is not null
  ),
  clean as (
    select * from sv where coalesce(value_label, '') <> ''
  ),
  n as (select count(distinct session_id)::numeric as total from clean),
  totals as (
    select question, value_label, count(distinct session_id) as cnt
    from clean
    group by question, value_label
  ),
  pairs as (
    select x.question as q_a, x.value_label as v_a,
           y.question as q_b, y.value_label as v_b,
           count(distinct x.session_id) as both_cnt
    from clean x
    join clean y
      on x.session_id = y.session_id
     and x.question < y.question        -- perguntas diferentes, sem par duplicado
    group by x.question, x.value_label, y.question, y.value_label
  )
  select p.q_a, p.v_a, p.q_b, p.v_b,
         p.both_cnt,
         ta.cnt as a_total,
         tb.cnt as b_total,
         round(p.both_cnt::numeric / ta.cnt, 3)                       as confidence,
         round((p.both_cnt::numeric * n.total) / (ta.cnt * tb.cnt), 2) as lift
  from pairs p
  cross join n
  join totals ta on ta.question = p.q_a and ta.value_label = p.v_a
  join totals tb on tb.question = p.q_b and tb.value_label = p.v_b
  where p.both_cnt >= p_min_support
  order by lift desc, both_cnt desc
  limit 80;
$$;

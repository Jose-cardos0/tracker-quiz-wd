-- ============================================================================
--  Aggregation functions used by the dashboard (called via .rpc()).
--  All read-only / STABLE. Called with the service-role key (bypasses RLS).
-- ============================================================================

-- Funnel: how many sessions reached each step (retention curve).
create or replace function project_funnel(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (step_index int, sessions_reached bigint)
language sql stable as $$
  with steps as (
    select generate_series(
      1, coalesce((select total_steps from projects where id = p_id), 0)
    ) as step_index
  ),
  s as (
    select max_step from sessions
    where project_id = p_id and started_at >= p_from and started_at < p_to
  )
  select steps.step_index,
         count(s.max_step) filter (where s.max_step >= steps.step_index)
           as sessions_reached
  from steps left join s on true
  group by steps.step_index
  order by steps.step_index;
$$;

-- Time spent per step (avg + median), from step_exit events.
create or replace function project_step_timing(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (step_index int, avg_ms numeric, median_ms numeric, samples bigint)
language sql stable as $$
  select step_index,
         round(avg(duration_ms))                                       as avg_ms,
         percentile_cont(0.5) within group (order by duration_ms)      as median_ms,
         count(*)                                                      as samples
  from events
  where project_id = p_id and type = 'step_exit'
    and created_at >= p_from and created_at < p_to
    and duration_ms is not null
  group by step_index
  order by step_index;
$$;

-- Headline numbers for a project in a time window.
create or replace function project_overview(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  sessions bigint, visitors bigint, completed bigint, avg_duration_ms numeric
)
language sql stable as $$
  select count(*)                                  as sessions,
         count(distinct visitor_id)                as visitors,
         count(*) filter (where completed)         as completed,
         round(avg(duration_ms))                   as avg_duration_ms
  from sessions
  where project_id = p_id and started_at >= p_from and started_at < p_to;
$$;

-- Breakdown by campaign (utm_source / utm_campaign / your cid).
create or replace function project_campaigns(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  source text, campaign text, cid text,
  sessions bigint, completed bigint, avg_max_step numeric
)
language sql stable as $$
  select coalesce(utm->>'utm_source', '(direto)')   as source,
         coalesce(utm->>'utm_campaign', '')          as campaign,
         coalesce(cid, '')                           as cid,
         count(*)                                    as sessions,
         count(*) filter (where completed)           as completed,
         round(avg(max_step), 1)                     as avg_max_step
  from sessions
  where project_id = p_id and started_at >= p_from and started_at < p_to
  group by 1, 2, 3
  order by sessions desc;
$$;

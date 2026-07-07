-- ============================================================================
--  Origem por referrer (fallback). Rode UMA vez no SQL Editor.
--  Quando o tráfego (ex.: Facebook) chega SEM utm mas com referrer, a origem
--  passa a ser inferida pelo domínio do referrer em vez de virar "(direto)".
-- ============================================================================

create or replace function project_campaigns(
  p_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (
  source text, campaign text, cid text,
  sessions bigint, completed bigint, avg_max_step numeric
)
language sql stable as $$
  select coalesce(
           nullif(utm->>'utm_source', ''),
           case
             when referrer ~* 'facebook|fb\.com|fb\.watch' then 'facebook'
             when referrer ~* 'instagram'                  then 'instagram'
             when referrer ~* 'youtube|youtu\.be'          then 'youtube'
             when referrer ~* 'google'                     then 'google'
             when referrer ~* 'tiktok'                     then 'tiktok'
             when referrer ~* 'bing'                       then 'bing'
             when referrer ~* 't\.co|twitter|x\.com'       then 'twitter'
             when referrer ~* 'whatsapp|wa\.me'            then 'whatsapp'
             when coalesce(referrer, '') <> ''             then 'outro'
             else null
           end,
           '(direto)'
         )                                          as source,
         coalesce(utm->>'utm_campaign', '')         as campaign,
         coalesce(cid, '')                          as cid,
         count(*)                                   as sessions,
         count(*) filter (where completed)          as completed,
         round(avg(max_step), 1)                    as avg_max_step
  from sessions
  where project_id = p_id and started_at >= p_from and started_at < p_to
  group by 1, 2, 3
  order by sessions desc;
$$;

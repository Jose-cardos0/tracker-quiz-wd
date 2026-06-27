-- ============================================================================
--  Limpeza de sessões de BOT (revisão de anúncio da Meta, crawlers, headless)
--  -------------------------------------------------------------------------
--  Rode no SQL editor do Supabase. Faça em 2 passos:
--    1) Rode o PREVIEW e confira os números/linhas.
--    2) Só então rode o bloco DELETE (transacional). Confira a contagem
--       antes do COMMIT — se algo parecer errado, troque por ROLLBACK.
--
--  O que é considerado bot aqui:
--    (a) user_agent de bot conhecido, OU
--    (b) UTM com macro do Facebook NÃO-substituída ([FB], %5BFB%5D, {{...}})
--        numa sessão que parou na etapa 1 e não concluiu — exatamente o
--        padrão das linhas "%5BFB%5D-%" e dos hits da revisão de anúncio.
--
--  Esta limpeza é do PASSADO. Daqui pra frente o track.js e o /api/collect
--  já descartam esse tráfego (não conta mais como sessão/visitante).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PREVIEW — quantas sessões/visitantes seriam removidos
-- ----------------------------------------------------------------------------
with bots as (
  select session_id, visitor_id
  from sessions
  where
    coalesce(user_agent, '') ~* 'bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|facebookcatalog|bingpreview|headless|lighthouse|phantom|puppeteer|playwright|selenium|semrush|ahrefs|petalbot|baiduspider|yandex|whatsapp|telegram|skypeuripreview'
    or (
      max_step <= 1 and completed = false and (
        utm::text ilike '%5BFB%5D%' or   -- [FB] URL-encoded (macro não expandida)
        utm::text ilike '%[FB]%'    or   -- [FB] literal
        utm::text like  '%{{%'           -- {{...}} (macro crua do Facebook)
      )
    )
)
select
  count(*)                    as sessoes_bot,
  count(distinct visitor_id)  as visitantes_envolvidos
from bots;

-- Para inspecionar linha a linha (opcional), rode no lugar do count acima:
--   select s.started_at, s.utm->>'utm_source' as source, s.max_step,
--          s.device, s.country, left(s.user_agent, 60) as ua
--   from sessions s
--   where s.session_id in (select session_id from bots)
--   order by s.started_at desc;


-- ----------------------------------------------------------------------------
-- 2) DELETE — rode os 2 statements abaixo (nessa ordem). Não usa tabela
--    temporária, pra funcionar no editor do Supabase sem o erro
--    "relation _bot_sessions does not exist".
-- ----------------------------------------------------------------------------

-- 2a) Apaga eventos + sessões de bot num único statement.
--     O CTE "bots" captura os ids ANTES de qualquer delete (snapshot único),
--     então o delete de events e o de sessions enxergam o mesmo conjunto.
with bots as (
  select session_id
  from sessions
  where
    coalesce(user_agent, '') ~* 'bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|facebookcatalog|bingpreview|headless|lighthouse|phantom|puppeteer|playwright|selenium|semrush|ahrefs|petalbot|baiduspider|yandex|whatsapp|telegram|skypeuripreview'
    or (
      max_step <= 1 and completed = false and (
        utm::text ilike '%5BFB%5D%' or
        utm::text ilike '%[FB]%'    or
        utm::text like  '%{{%'
      )
    )
),
del_events as (
  delete from events
  where session_id in (select session_id from bots)
  returning 1
)
delete from sessions
where session_id in (select session_id from bots);

-- 2b) Remove visitantes órfãos (que ficaram sem nenhuma sessão).
--     Roda DEPOIS do 2a. Pega os órfãos criados acima + qualquer órfão antigo.
delete from visitors v
where not exists (
  select 1 from sessions s where s.visitor_id = v.visitor_id
);

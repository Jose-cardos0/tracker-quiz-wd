-- ============================================================================
--  Ingestion helper: upserts the visitor + session and folds in the
--  aggregates from one batch of events, atomically. Called by /api/collect.
-- ============================================================================
create or replace function apply_ingest(
  p_session     uuid,
  p_visitor     uuid,
  p_project     uuid,
  p_utm         jsonb,
  p_first_utm   jsonb,
  p_cid         text,
  p_referrer    text,
  p_landing     text,
  p_country     text,
  p_device      text,
  p_ua          text,
  p_started     timestamptz,
  p_max_step    int,
  p_add_dur     int,
  p_completed   boolean
) returns void
language plpgsql as $$
begin
  -- visitor: create once (keeps first-touch), then bump last_seen
  insert into visitors (visitor_id, first_seen, last_seen, first_utm, device, country)
  values (p_visitor, now(), now(), p_first_utm, p_device, p_country)
  on conflict (visitor_id) do update
    set last_seen = now(),
        country   = coalesce(excluded.country, visitors.country),
        device    = coalesce(excluded.device, visitors.device);

  -- session: create once with attribution, then fold aggregates
  insert into sessions (
    session_id, visitor_id, project_id, utm, cid, referrer, landing_url,
    country, device, user_agent, started_at, last_event_at,
    max_step, duration_ms, completed
  ) values (
    p_session, p_visitor, p_project, p_utm, p_cid, p_referrer, p_landing,
    p_country, p_device, p_ua, coalesce(p_started, now()), now(),
    greatest(coalesce(p_max_step, 0), 0),
    greatest(coalesce(p_add_dur, 0), 0),
    coalesce(p_completed, false)
  )
  on conflict (session_id) do update
    set last_event_at = now(),
        max_step      = greatest(sessions.max_step, coalesce(p_max_step, 0)),
        duration_ms   = sessions.duration_ms + greatest(coalesce(p_add_dur, 0), 0),
        completed     = sessions.completed or coalesce(p_completed, false);
end;
$$;

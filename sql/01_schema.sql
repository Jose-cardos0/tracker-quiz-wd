-- ============================================================================
--  Funnel Tracker — schema
--  Run this in the Supabase SQL editor (or via the CLI) once.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  projects : each quiz or landing/sales page
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  type         text not null default 'quiz',     -- 'quiz' | 'page'
  total_steps  int,                              -- number of steps (for funnel %)
  step_names   jsonb,                            -- optional: { "1": "Sexo", ... }
  storage_path text,                             -- public/quizzes/<slug> (v1: local)
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  visitors : unique person across sessions (the "ID único")
-- ----------------------------------------------------------------------------
create table if not exists visitors (
  visitor_id  uuid primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  first_utm   jsonb,                             -- first-touch attribution
  device      text,
  country     text
);

-- ----------------------------------------------------------------------------
--  sessions : one visit
-- ----------------------------------------------------------------------------
create table if not exists sessions (
  session_id    uuid primary key,
  visitor_id    uuid references visitors (visitor_id),
  project_id    uuid references projects (id),
  utm           jsonb,                           -- attribution for THIS session
  cid           text,                            -- your own campaign id (?cid=)
  referrer      text,
  landing_url   text,
  country       text,
  device        text,
  user_agent    text,
  started_at    timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  max_step      int not null default 0,          -- furthest step => drop-off point
  duration_ms   int not null default 0,          -- total active time
  completed     boolean not null default false
);

create index if not exists sessions_project_started_idx
  on sessions (project_id, started_at desc);
create index if not exists sessions_visitor_idx on sessions (visitor_id);
create index if not exists sessions_cid_idx on sessions (cid);

-- ----------------------------------------------------------------------------
--  events : append-only, generic
-- ----------------------------------------------------------------------------
create table if not exists events (
  id          bigint generated always as identity primary key,
  project_id  uuid,
  session_id  uuid,
  visitor_id  uuid,
  type        text not null,        -- session_start | step_view | step_exit
                                     -- click | answer | quiz_complete
                                     -- checkout_redirect | custom
  step_index  int,
  step_name   text,
  duration_ms int,                  -- on step_exit: time spent on that step
  meta        jsonb,                -- click target, answer value, etc.
  url         text,
  created_at  timestamptz not null default now()
);

create index if not exists events_project_type_idx
  on events (project_id, type, created_at desc);
create index if not exists events_session_idx on events (session_id, created_at);

-- ----------------------------------------------------------------------------
--  RLS : lock everything. The app reads/writes with the service-role key
--        (which bypasses RLS). Auth/login uses the anon key but never
--        touches these tables directly, so no public policies are needed.
-- ----------------------------------------------------------------------------
alter table projects enable row level security;
alter table visitors enable row level security;
alter table sessions enable row level security;
alter table events   enable row level security;

-- ----------------------------------------------------------------------------
--  Seed: the existing healthmeai quiz (32 steps)
-- ----------------------------------------------------------------------------
insert into projects (slug, name, type, total_steps, storage_path, step_names)
values (
  'healthmeai', 'HealthMe (GLP-1) — Quiz', 'quiz', 32, 'public/quizzes/healthmeai',
  '{"1":"Sexo","2":"Idade","3":"Vídeo intro","4":"Tracking (GIF)","5":"Transformação",
    "6":"Jornada GLP-1","7":"Medicamento","8":"Dose","9":"Frequência","10":"Dificuldade",
    "11":"Scan alimentação","12":"Altura","13":"Peso atual","14":"Peso meta","15":"Mascote meta",
    "16":"3x mais rápido","17":"Resumo pessoal","18":"Previsão de peso","19":"Potencial sucesso",
    "20":"Vídeo prova social","21":"Motivação","22":"Atividade física","23":"Resultados duradouros",
    "24":"Vídeo prova social 2","25":"Companheiro virtual","26":"Transforme resultados",
    "27":"Avaliação","28":"Compromisso","29":"Plano pronto","30":"Depoimentos","31":"Oferta","32":"Checkout"}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  total_steps = excluded.total_steps,
  step_names = excluded.step_names;

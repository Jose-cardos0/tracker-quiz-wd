# Funnel Tracker

Plataforma própria de tracking de funil. Hospeda seus quizzes/páginas como
sites estáticos, gera um **ID único** por visitante, captura a campanha de
origem (UTM / cid), e registra **passos, tempo por etapa, abandono e cliques**.
Tudo aparece num dashboard com login.

- **Next.js 14** (App Router) — deploy na **Vercel**
- **Supabase** — Postgres (eventos), Auth (login), pg_cron (limpeza)
- **Tracker** vanilla JS (`public/track.js`) embutido nos quizzes

---

## Arquitetura (resumo)

```
Visitante  ──>  /quizzes/<slug>/index.html   (quiz estático + track.js)
                         │  eventos (lote, sendBeacon)
                         ▼
                 POST /api/collect            (Edge/Node, service-role)
                         │
                         ▼
                 Supabase Postgres            (visitors, sessions, events)
                         ▲
                         │  leitura (service-role)
                 Dashboard (/, /projects/...)  ← login Supabase Auth
```

- `visitor_id` (UUID) vive em localStorage + cookie → persiste entre visitas.
- `session_id` por visita (nova sessão após 30 min de inatividade).
- Atribuição: `utm_*`, `fbclid/gclid/ttclid`, `cid`, referrer — first-touch
  salvo no visitante.
- Drop-off = `sessions.max_step`. Conclusão = `sessions.completed`.

---

## Estrutura

```
app/
  (dashboard)/            páginas logadas (funil, sessões, campanhas)
  login/                  tela de login
  api/collect/route.ts    ingestão de eventos
lib/supabase/             clients (admin = service-role, server/client = auth)
lib/data.ts               leitura agregada do dashboard
public/track.js           o tracker (SDK)
public/quizzes/<slug>/    quiz estático (HTML + img) — servido direto
sql/                      01_schema, 02_functions, 03_ingest  (rodar 1x)
```

---

## Passo a passo de setup (o que VOCÊ faz)

### 1. Supabase
1. Crie um projeto (região **EU / Frankfurt** recomendada pelo público alemão).
2. Em **SQL Editor**, rode em ordem:
   - `sql/01_schema.sql`
   - `sql/02_functions.sql`
   - `sql/03_ingest.sql`
   - `sql/06_answers.sql`  (tabela de respostas deduplicadas — base do leadscore)
   - `sql/07_answer_stats.sql`  (agregações de respostas p/ a tela Leadscore)
   - `sql/09_answer_analysis.sql`  (conclusão por resposta + perfil numérico — Análises detalhadas)
   - `sql/10_answer_assoc.sql`  (associação/lift entre respostas — Análises detalhadas)
3. Em **Authentication → Users**, crie seu usuário (e-mail + senha). É com ele
   que você entra no dashboard. (Desative "Enable email signups" se quiser
   travar o acesso só a usuários criados por você.)
4. Em **Project Settings → API**, copie: `URL`, `anon key`, `service_role key`.

### 2. Variáveis de ambiente
Crie `.env.local` (local) e configure as mesmas na Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # SECRETO
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

### 3. Rodar local
```
npm install
npm run dev
```
- Dashboard: http://localhost:3000  (redireciona pro login)
- Quiz: http://localhost:3000/quizzes/healthmeai/index.html

### 4. Deploy na Vercel
1. Suba este projeto num repositório Git e importe na Vercel (ou `vercel`).
2. Em **Settings → Environment Variables**, cole as 4 variáveis acima.
3. Deploy.

### 5. Usar nas campanhas
Link do quiz para os anúncios:
```
https://seu-app.vercel.app/quizzes/healthmeai/index.html?utm_source=fb&utm_campaign=campanha1&cid=ABC123
```
- `utm_*` e `cid` são capturados e aparecem no dashboard por campanha.
- Use um `cid` por anúncio/criativo se quiser granularidade fina.

---

## Adicionar um novo quiz / página de venda — pelo dashboard

> Pré-requisito (uma vez): rode `sql/05_uploads.sql` no Supabase. Ele adiciona
> a coluna `hosting` e cria o bucket público `quizzes` no Storage.

1. No dashboard, clique **“+ Adicionar quiz”**.
2. Arraste o **`.html`** (página única) ou um **`.zip`** (HTML + imagens).
3. Confirme nome / tipo. O nº de etapas é **detectado automaticamente** (pode
   editar). Clique **Subir e publicar**.

O que acontece nos bastidores:
- O tracker é **injetado automaticamente** no HTML (com `autoSteps`).
- Os arquivos vão para o **Supabase Storage** (bucket `quizzes`).
- O projeto é registrado e já aparece no dashboard.
- A página fica em **`/q/<slug>/`** — é esse o link da campanha.

**Detecção automática de etapas:** o tracker observa o DOM e dispara o evento
de etapa sozinho quando uma seção `.step` / `[data-step]` fica visível — sem
você escrever `HMTrack.step`. Para nomear as etapas no funil, use o botão
**Editar** no projeto (ou deixe que ele pegue pelos títulos `<h1/h2>` das telas).

Limite: upload passa pela função serverless da Vercel (~4,5 MB por requisição).
Para quizzes com muita mídia, mantenha imagens leves ou hospede-as externamente.

### Editar / excluir (tudo no dashboard)
Abra o projeto → **Editar**: renomear, ajustar nº de etapas, rotular cada etapa,
ou **excluir** (remove o quiz do Storage e todos os dados de tracking).

### Modo “repo” (quizzes no código)
O `healthmeai` é servido de `public/quizzes/healthmeai/` (hosting `repo`), com
instrumentação manual via `HMTrack.step()`. Continua funcionando em paralelo ao
modo upload.

---

## API do tracker

| Chamada | Quando usar |
|---|---|
| `HMTrack.init({projectId, endpoint, totalSteps})` | uma vez, no `<head>` |
| `HMTrack.step(index, name)` | ao entrar em cada etapa |
| `HMTrack.answer(question, value)` | resposta escolhida |
| `HMTrack.event(type, meta)` | evento custom (`checkout_redirect`, etc.) |

Automático: `session_start`, cliques, tempo por etapa (`step_exit`),
`reached_last`, e flush na saída via `sendBeacon`.

---

## GDPR (público UE) — pendente

O tracking usa cookie/ID. Antes de escalar tráfego na UE, adicionar:
banner de consentimento, anonimização de IP (já não gravamos IP cru), e
retenção (cron apagando eventos antigos). Ver seção de próximos passos.

# LogiBot Backend

Backend Node/Express do SAEL (Sistema de Apoio ao Ensino de Logica), responsavel por autenticacao, quizzes, chat, historico, dados academicos, dashboards, logs e feedbacks.

## Runtime Atual

Este projeto agora roda como um servidor Node.js/Express em VPS, usando PostgreSQL via Drizzle ORM e `pg`.

Cloudflare Workers, Wrangler, Neon serverless, bindings `c.env` e Cloudflare AI nao fazem parte do runtime de producao. A pasta `src/worker` permanece apenas como referencia historica e esta excluida do build TypeScript.

## Scripts

```bash
npm run dev        # servidor local com ts-node-dev
npm run build      # compila TypeScript para dist/
npm start          # roda dist/server.js
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Variaveis De Ambiente

Copie `.env.example` para `.env` em desenvolvimento ou configure as variaveis equivalentes na VPS:

```env
PORT=43187
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DB_POOL_MAX=10

JWT_SECRET=change-me
API_KEY=

HTTP_REQUEST_LOGS=true
METRICS_ENABLED=false
METRICS_API_KEY=

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS=change-me
MAIL_FROM="LogiBot <user@example.com>"
PASSWORD_RESET_DEBUG_RESPONSE=false

DIGITALOCEAN_AGENT_ENDPOINT=
DIGITALOCEAN_AGENT_ACCESS_KEY=
DIGITALOCEAN_AGENT_TIMEOUT_MS=30000
DIGITALOCEAN_AGENT_TIMEOUT_CAP_MS=45000
DIGITALOCEAN_AGENT_CONCURRENCY_PER_AGENT=1
DIGITALOCEAN_AGENT_QUEUE_MAX_SIZE=100
DIGITALOCEAN_AGENT_QUEUE_TIMEOUT_MS=10000
SELF_RAG_DECISION_TIMEOUT_MS=5000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=2000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=40000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=5000
EMBEDDING_SERVICE_URL=https://embedapi.saellogibot.com
EMBEDDING_SERVICE_API_KEY=
RAG_UPLOAD_DIR=/tmp/logibots/uploads/rag
CHROMA_URL=http://logibots-chroma:8000
CHROMA_COLLECTION=logibots_rag_chunks
```

## Banco

O schema Drizzle fica em `src/db/schema.ts`, as migracoes em `drizzle/` e o seed em `src/db/seed.ts`.

O seed cria:

- usuario admin
- universidade, curso, turma e disciplina base
- aluno de teste vinculado a disciplina

## Rotas Principais

- `GET /health`, `/health/simple`, `/health/ready`, `/health/ping`
- `/auth/*`
- `/account/*`
- `/quiz/*`
- `/chat/*`
- `/academic/*`
- `/admin/*`
- `/dashboard/*`
- `/logs/*`
- `/analytics/*`
- `POST /feedback`

## IA

O endpoint `POST /chat/messages` usa o Agent da DigitalOcean quando `DIGITALOCEAN_AGENT_ENDPOINT` e `DIGITALOCEAN_AGENT_ACCESS_KEY` estao configurados. `DIGITALOCEAN_AGENT_ENDPOINT` deve ser a URL completa de chat completions fornecida pela DigitalOcean. Se o Agent falhar ou nao estiver configurado, o backend preserva uma resposta fallback controlada.

Para aumentar concorrencia sem saturar o provedor, o backend tambem aceita um pool de ate 5 Agents da DigitalOcean. A cada chamada, ele aguarda vaga em uma fila local e usa o Agent menos ocupado no processo atual.

Formato numerado, recomendado para preencher no painel do deploy:

```env
DIGITALOCEAN_AGENT_1_ENDPOINT=
DIGITALOCEAN_AGENT_1_ACCESS_KEY=
DIGITALOCEAN_AGENT_2_ENDPOINT=
DIGITALOCEAN_AGENT_2_ACCESS_KEY=
# ...
DIGITALOCEAN_AGENT_5_ENDPOINT=
DIGITALOCEAN_AGENT_5_ACCESS_KEY=
```

Formato em lista, pareado por posicao:

```env
DIGITALOCEAN_AGENT_ENDPOINTS=https://agent-1...,https://agent-2...
DIGITALOCEAN_AGENT_ACCESS_KEYS=key-1,key-2
```

As variaveis antigas `DIGITALOCEAN_AGENT_ENDPOINT` e `DIGITALOCEAN_AGENT_ACCESS_KEY` continuam funcionando e entram como o Agent `default`. O limite de 5 e total, entao o `default` tambem conta.

Variaveis da fila:

```env
DIGITALOCEAN_AGENT_CONCURRENCY_PER_AGENT=1
DIGITALOCEAN_AGENT_QUEUE_MAX_SIZE=100
DIGITALOCEAN_AGENT_QUEUE_TIMEOUT_MS=10000
DIGITALOCEAN_AGENT_TIMEOUT_CAP_MS=45000
```

`DIGITALOCEAN_AGENT_CONCURRENCY_PER_AGENT=1` significa que cada Agent recebe uma chamada por vez. As demais requests ficam na fila do backend ate abrir vaga.
O `DIGITALOCEAN_AGENT_TIMEOUT_CAP_MS` limita o timeout efetivo do Agent para evitar que o frontend/proxy desista antes do backend retornar fallback controlado.

No modo `self`, o backend faz uma chamada curta ao Agent para decidir se deve recuperar materiais e depois pode fazer uma segunda chamada para responder. Por isso ele tem orcamento proprio:

```env
SELF_RAG_DECISION_TIMEOUT_MS=5000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=2000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=40000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=5000
```

Esses defaults evitam que o `self` some duas esperas longas e ultrapasse o timeout de 60s do teste/proxy.

## Observabilidade

O backend expoe `GET /metrics` para Prometheus quando `METRICS_ENABLED=true`.
Esse endpoint fica fora do `API_KEY` publico e exige `Authorization: Bearer <METRICS_API_KEY>`.

A stack local de Prometheus/Grafana fica em `observability/` e o teste de carga k6 em `load-tests/chat-stress.js`.

## Testes De Carga K6

O script `../k6-chat.ps1` aceita cenarios separados para isolar gargalos:

```powershell
# backend puro
.\k6-chat.ps1 -K6Profile smoke -K6Test health

# autenticacao pura
.\k6-chat.ps1 -K6Profile smoke -K6Test auth

# chat por modo RAG
.\k6-chat.ps1 -K6Profile smoke -K6Test none
.\k6-chat.ps1 -K6Profile smoke -K6Test context
.\k6-chat.ps1 -K6Profile smoke -K6Test self

# todos, dividindo a carga de chat entre none/context/self
.\k6-stress.cmd
```

Credenciais configuraveis:

```env
K6_NONE_EMAIL=
K6_NONE_PASSWORD=
K6_CONTEXT_EMAIL=
K6_CONTEXT_PASSWORD=
K6_SELF_EMAIL=
K6_SELF_PASSWORD=
```

Essas variaveis sao obrigatorias para cenarios de chat/auth. O cenario `health` nao exige credenciais.

## Emails

O fluxo `POST /auth/password-reset-requests` envia email via SMTP usando Nodemailer. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM` no Dokploy.

## Deploy VPS

1. Instale Node.js LTS e PostgreSQL.
2. Configure `.env` com `DATABASE_URL` e `JWT_SECRET`.
3. Rode `npm ci`.
4. Rode `npm run db:migrate`.
5. Rode `npm run db:seed` se o banco for novo.
6. Rode `npm run build`.
7. Inicie `npm start` com seu gerenciador de processo, por exemplo PM2 ou systemd.

## Docker / Dokploy

O backend possui um `Dockerfile` multi-stage pronto para Dokploy.

Portas ja ocupadas no servidor: `3002`, `3003`, `3010`, `3333`, `5173`, `5189`, `5433`, `5435`, `5436`. Para o LogiBot backend foi escolhido:

```env
PORT=43187
```

A fonte da verdade da porta do backend e sempre a variavel `PORT` quando ela existir no ambiente. Se `PORT` nao for carregada, o backend usa o fallback interno `43187`. O codigo Express e o CORS local seguem essa mesma regra.

No Dokploy, configure a aplicacao para expor a mesma porta definida em `PORT`.

Variaveis recomendadas para o container:

```env
PORT=43187
DATABASE_URL=postgresql://USER:PASSWORD@logibot-db:5432/DATABASE
JWT_SECRET=change-me
API_KEY=
DB_POOL_MAX=10
HTTP_REQUEST_LOGS=true
DIGITALOCEAN_AGENT_ENDPOINT=
DIGITALOCEAN_AGENT_ACCESS_KEY=
DIGITALOCEAN_AGENT_TIMEOUT_MS=30000
DIGITALOCEAN_AGENT_TIMEOUT_CAP_MS=45000
DIGITALOCEAN_AGENT_CONCURRENCY_PER_AGENT=1
DIGITALOCEAN_AGENT_QUEUE_MAX_SIZE=100
DIGITALOCEAN_AGENT_QUEUE_TIMEOUT_MS=10000
SELF_RAG_DECISION_TIMEOUT_MS=5000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=2000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=40000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=5000
EMBEDDING_SERVICE_URL=https://embedapi.saellogibot.com
EMBEDDING_SERVICE_API_KEY=
RAG_UPLOAD_DIR=/tmp/logibots/uploads/rag
CHROMA_URL=http://logibot-chromadb-dwit3i-5b77f2-69-62-93-80.sslip.io:8000
CHROMA_COLLECTION=logibots_rag_chunks
```

Os dominios de frontend e cookie ficam hardcoded no backend: `https://saellogibot.com`, `https://www.saellogibot.com` e localhosts de teste (`5173`, `5174`, `3000`, `3001`). O cookie de producao usa `.saellogibot.com`.

Se o PostgreSQL do LogiBot for acessado pelo host publicado, use a porta `5437` no `DATABASE_URL`. Se backend e banco estiverem na mesma rede/stack Docker, use a porta interna `5432`.

Comandos uteis no Dokploy:

```bash
# start command padrao do Dockerfile
node dist/server.js

# executar manualmente em console/job
npm run db:migrate:prod
npm run db:seed:prod
npm run rag:worker
```

Rode `db:migrate:prod` antes do primeiro start ou como job de deploy. Rode `db:seed:prod` apenas quando quiser popular/atualizar os dados iniciais.

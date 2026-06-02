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
JWT_SECRET=change-me
API_KEY=
DB_POOL_MAX=10
HTTP_REQUEST_LOGS=true
ENABLE_SWAGGER=false
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

A fonte da verdade da porta do backend e sempre a variavel `PORT` quando ela existir no ambiente. Se `PORT` nao for carregada, o backend usa o fallback interno `43187`. O codigo Express, CORS local e Swagger local seguem essa mesma regra.

No Dokploy, configure a aplicacao para expor a mesma porta definida em `PORT`.

Variaveis recomendadas para o container:

```env
PORT=43187
DATABASE_URL=postgresql://USER:PASSWORD@logibot-db:5432/DATABASE
JWT_SECRET=change-me
API_KEY=
DB_POOL_MAX=10
HTTP_REQUEST_LOGS=true
ENABLE_SWAGGER=false
DIGITALOCEAN_AGENT_ENDPOINT=
DIGITALOCEAN_AGENT_ACCESS_KEY=
DIGITALOCEAN_AGENT_TIMEOUT_MS=30000
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
```

Rode `db:migrate:prod` antes do primeiro start ou como job de deploy. Rode `db:seed:prod` apenas quando quiser popular/atualizar os dados iniciais.

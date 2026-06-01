# LogiBot Backend

Backend do sistema SAEL (Sistema de Apoio ao Ensino de Lógica), responsável por autenticação, geração de quizzes, conversa com IA, histórico de chat e dados acadêmicos.

---

## Migração em andamento: Express → Hono (Cloudflare Workers)

O backend está sendo migrado de um servidor **Node.js/Express** (com MongoDB) para um **Cloudflare Worker** usando **Hono** (com PostgreSQL via Drizzle ORM + Neon).

**O Worker Hono é o código em produção.** O servidor Express não está em uso ativo — ele existe apenas como referência durante a migração. Rotas ainda não portadas retornam `501 Not Implemented` até serem migradas.

---

## Estrutura do projeto

```
src/
├── index.ts                    # Ponto de entrada do Cloudflare Worker (exporta o app Hono)
├── server.ts                   # Servidor Express legado — apenas referência, não está em produção
│
├── worker/                     # ✅ CÓDIGO ATIVO (Cloudflare Worker)
│   ├── app.ts                  # App Hono principal com middleware stack
│   ├── types.ts                # Tipos TypeScript (Env, AuthUser, AppBindings)
│   ├── errors.ts               # Classe HttpError e formatação de erros
│   ├── http/
│   │   ├── auth.ts             # Middlewares: requireAuth, requireRoles, requireApiKey
│   │   └── cors.ts             # Configuração de CORS
│   ├── security/
│   │   ├── jwt.ts              # Assinatura/verificação de sessão JWT (jose, HS256, 2h)
│   │   ├── cookies.ts          # Gerenciamento de cookie de auth (HttpOnly, Secure)
│   │   └── password.ts         # Hash e verificação de senha (bcryptjs)
│   ├── services/
│   │   ├── chatHistory.ts      # Gestão de sessões e mensagens de chat (PostgreSQL)
│   │   ├── sessionMemory.ts    # Estado de sessão SAEL em memória (nível, assunto, perguntas)
│   │   ├── quiz.ts             # Geração e verificação de quizzes
│   │   ├── rasa.ts             # Simulação das actions do SAEL (sem Rasa externo)
│   │   ├── userAnalysis.ts     # Re-exporta startStudentSession
│   │   └── disciplineCode.ts   # Geração/decodificação de código de disciplina
│   ├── db/
│   │   └── client.ts           # getDb(env) — instância Drizzle para o Worker
│   └── routes/                 # Rotas Hono
│       ├── health.ts           # ✅ /health, /ping
│       ├── auth.ts             # ✅ /users, /session, /me, /logout
│       ├── quiz.ts             # ✅ /quiz/*
│       ├── sael.ts             # ✅ /sael/action/*
│       ├── history.ts          # ✅ /history/chat/*
│       ├── useranalysis.ts     # ✅ /useranalysis/*
│       ├── academicFilters.ts  # ✅ /academicFilters/data
│       └── notImplemented.ts   # 🚧 Retorna 501 para rotas ainda não portadas
│
├── db/
│   ├── schema.ts               # Schema Drizzle ORM (PostgreSQL) — fonte de verdade do banco
│   ├── client.ts               # Cliente de banco compatível com Express e Worker
│   ├── seed.ts                 # Seed de dados para desenvolvimento
│   └── repositories/
│       └── authRepository.ts   # Queries de autenticação, perfis, sessões de análise
│
├── routes/          # ⚠️  LEGADO — rotas Express, apenas referência durante migração
├── controllers/     # ⚠️  LEGADO — controllers Express (MongoDB), apenas referência
├── services/        # ⚠️  LEGADO — services Express (MongoDB), apenas referência
└── models/          # ⚠️  LEGADO — models Mongoose (MongoDB), apenas referência
```

---

## Status da migração

### ✅ Rotas já portadas para o Worker Hono

| Prefixo | Endpoints | Observação |
|---|---|---|
| `/health` | GET /health, /health/simple, /health/ready, /ping | — |
| `/users` | POST /users | Cadastro de estudante |
| `/session` | POST /session | Login |
| `/me` | GET /me | Dados do usuário autenticado |
| `/logout` | POST /logout | — |
| `/quiz` | GET /levels, POST /set-level, /subcategories, /generate, /verify | — |
| `/sael/action` | GET inicio, listar_niveis, listar_opcoes, get_gabarito | — |
| `/sael/action` | POST conversar, definir_nivel, listar_subopcoes, gerar_perguntas, **perguntar** | `/perguntar` usa Cloudflare AI |
| `/history` | GET /chat/sessions/:userId, /chat/messages/:userId/:sessionId | Histórico salvo em PostgreSQL |
| `/useranalysis` | POST /interaction, /subject-clicks | Rastreamento de assuntos por sessão |
| `/academicFilters` | GET /data | Filtrado por role (admin / professor / coordenador) |
| `/dashboard` | POST /topic-performance, /proficiency-radar, /effort-matrix, /learning-journey, /session-details, /access-pattern | Analytics de desempenho |
| `/logs` | POST /student/summary/filtered, GET /university/:id/summary, /course/:id/summary, /class/:id/summary, /professor/students, /professor/students/:id, /professor/students-stats | Logs de uso com controle de acesso por role |

### 🚧 Rotas ainda não portadas (retornam 501)

| Prefixo | Descrição |
|---|---|
| `/admin` | Gestão de professores, estudantes e coordenadores (20+ endpoints) |
| `/password` | Fluxo de redefinição de senha |
| `/feedbacks` | Coleta de feedbacks |
| `/academic-institution` | CRUD de universidades, cursos, turmas e disciplinas |

---

## Stack tecnológica

### Worker (produção)
| Tecnologia | Uso |
|---|---|
| [Hono](https://hono.dev) | Framework HTTP para Cloudflare Workers |
| [Cloudflare Workers](https://workers.cloudflare.com) | Plataforma de execução edge |
| [Cloudflare AI](https://ai.cloudflare.com) | Modelo LLM para o chat (`@cf/meta/llama-3.1-8b-instruct-fp8`) |
| [Drizzle ORM](https://orm.drizzle.team) | ORM typesafe para PostgreSQL |
| [Neon](https://neon.tech) | PostgreSQL serverless |
| [jose](https://github.com/panva/jose) | JWT (HS256, expiração 2h) |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Hash de senha |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | CLI de desenvolvimento e deploy |

### Express (legado — apenas referência)
| Tecnologia | Uso |
|---|---|
| Express 4 | Servidor HTTP (não está em produção) |
| Mongoose | ODM MongoDB (apenas nos controllers legados) |
| MongoDB | Banco de dados legado |

---

## Como desenvolver

### Worker (código em produção)
```bash
npm run worker:dev    # Inicia o Worker localmente com Wrangler
npm run worker:deploy # Faz deploy para Cloudflare
```

### Express (legado — apenas para consulta)
```bash
npm run dev           # Inicia o servidor Express localmente
```

### Banco de dados
```bash
npm run db:push       # Aplica o schema Drizzle no banco PostgreSQL
npm run db:seed       # Popula o banco com dados de desenvolvimento
npm run db:studio     # Abre o Drizzle Studio (UI do banco)
```

---

## Padrão de migração de rotas

Para portar uma rota do Express para o Worker Hono:

1. **Criar o arquivo de rota** em `src/worker/routes/<nome>.ts`:
```typescript
import { Hono } from "hono";
import { requireAuth } from "../http/auth";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import type { AppBindings } from "../types";

export const minhasRoutes = new Hono<AppBindings>();

minhasRoutes.use("/prefixo/*", requireAuth);

minhasRoutes.get("/prefixo/endpoint", async (c) => {
  const user = c.get("user")!;
  const db = getDb(c.env);
  // ... lógica usando Drizzle ORM (PostgreSQL)
  return c.json({ data });
});
```

2. **Registrar no `app.ts`** antes de `notImplementedRoutes`:
```typescript
app.route("/", minhasRoutes);
```

3. **Remover o prefixo** do array `pendingPrefixes` em `notImplemented.ts`.

### Regras importantes
- Use `throw new HttpError("mensagem", statusCode)` para erros — o handler global converte para JSON
- Use `getDb(c.env)` para acesso ao banco (Drizzle + PostgreSQL), nunca Mongoose
- O usuário autenticado fica em `c.get("user")` após o `requireAuth`
- Para restrição de roles: `requireRoles(["admin", "professor"])`
- O schema completo do banco está em `src/db/schema.ts`

---

## Variáveis de ambiente (Worker)

Configuradas no `wrangler.toml` e via secrets do Cloudflare:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Neon PostgreSQL |
| `JWT_SECRET` | Chave para assinatura de tokens JWT |
| `API_KEY` | Chave de API opcional para proteger o Worker |
| `FRONT_URL` | URL do frontend (CORS) |
| `COOKIE_DOMAIN` | Domínio do cookie de autenticação |
| `CLOUDFLARE_AI_MODEL` | Modelo de IA (default: `@cf/meta/llama-3.1-8b-instruct-fp8`) |
| `AI` | Binding do Cloudflare AI (configurado no `wrangler.toml`) |

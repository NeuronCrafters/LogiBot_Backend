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

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS=change-me
MAIL_FROM="LogiBot <user@example.com>"
PASSWORD_RESET_DEBUG_RESPONSE=false

OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_TIMEOUT_MS=180000
OPENROUTER_TIMEOUT_CAP_MS=300000
OPENROUTER_MAX_CONCURRENCY=5
OPENROUTER_QUEUE_MAX_SIZE=100
OPENROUTER_QUEUE_TIMEOUT_MS=600000
AGENT_MAX_ATTEMPTS=3
AGENT_RETRY_DELAY_MS=1500
QUIZ_AI_GENERATION_TIMEOUT_MS=300000
DASHBOARD_INSIGHTS_TIMEOUT_MS=90000
SELF_RAG_DECISION_TIMEOUT_MS=60000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=600000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=180000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=600000
CHAT_GENERATION_JOB_TIMEOUT_MS=600000
CHAT_GENERATION_MAX_ATTEMPTS=1
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

O endpoint `POST /chat/messages` salva a mensagem do aluno, cria um job em `chat_generation_jobs` e retorna `202` com `jobId`. O worker (`npm run worker`) processa RAG + Agent em background, salva a resposta real no historico e o frontend consulta `GET /chat/jobs/:jobId` ate concluir.

Chat, quizzes e insights usam a OpenRouter, com a mesma chave e o mesmo modelo definidos no servidor. Preencha `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` no `.env`. O modelo deve ser o identificador exato disponível na sua conta, no formato `provedor/modelo`; não há modelo escolhido automaticamente.

O cliente envia `POST https://openrouter.ai/api/v1/chat/completions` com autenticação Bearer, modelo e mensagens. `OPENROUTER_BASE_URL` aceita a URL base da API ou a URL completa de chat completions. Os prompts `PROMPT_CHAT.md`, `PROMPT_QUIZ.md` e `PROMPT_DASHBOARD_INSIGHTS.md` são carregados pela aplicação e incluídos nas imagens da API e do worker. A decisão técnica do Self-RAG usa seu próprio prompt JSON.

Sem chave ou modelo, o chat mantém a resposta de indisponibilidade existente e quiz/insights retornam 503. A migração não exige variáveis do provedor anterior. Embeddings e ChromaDB continuam usando seus serviços próprios.

`OPENROUTER_MAX_CONCURRENCY` limita chamadas de chat por processo. A fila aceita até `OPENROUTER_QUEUE_MAX_SIZE` solicitações e aguarda até `OPENROUTER_QUEUE_TIMEOUT_MS`. API e worker mantêm filas independentes; com limite 5 em cada processo, podem existir até 10 chamadas de chat simultâneas, além das chamadas de quiz e insights, que não usam essa fila. Ajuste esses valores e `CHAT_WORKER_CONCURRENCY` ao orçamento da conta antes de escalar instâncias.

`OPENROUTER_TIMEOUT_MS` define o timeout do chat, limitado por `OPENROUTER_TIMEOUT_CAP_MS`. Quiz e insights usam seus timeouts específicos. A política compartilhada retenta rede, timeout e HTTP 408/429/5xx; HTTP 401/402/403 não são retentados. `Retry-After` é respeitado quando recebido. Streaming só pode ser reiniciado antes do primeiro token e propaga cancelamento à chamada HTTP.

Referências: [API OpenRouter](https://openrouter.ai/docs/api_reference/overview) e [streaming SSE](https://openrouter.ai/docs/api_reference/streaming).

No modo `self`, o backend faz uma chamada curta ao Agent para decidir se deve recuperar materiais e depois pode fazer uma segunda chamada para responder. Por isso ele tem orcamento proprio:

```env
SELF_RAG_DECISION_TIMEOUT_MS=60000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=600000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=180000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=600000
```

Esses defaults permitem respostas lentas de modelos remotos. O limite geral do job fica em `CHAT_GENERATION_JOB_TIMEOUT_MS`.

## Observabilidade

Os logs do backend e do worker sao transmitidos em tempo real via Socket.IO (`/admin/logs` no frontend) e
o teste de carga k6 fica em `load-tests/chat-stress.js`.

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

## Validação local com Docker

Nenhuma instalação local de Node.js, npm ou PostgreSQL é necessária. Crie `.env` a partir de `.env.example` se ele ainda não existir e configure `JWT_SECRET` com um valor aleatório. O `.env` local preparado para esta entrega já possui esse valor. O arquivo é ignorado pelo Git e excluído das imagens.

Preencha `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` para testar geração real. O `.env.example` usa o PostgreSQL do ambiente local abaixo. Para acessar outro banco, ajuste `DATABASE_URL` e utilize o Compose principal sem o arquivo local.

```bash
docker compose --profile test run --build --rm tests
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build --wait
curl http://localhost:43187/health
```

O arquivo local sobe PostgreSQL, ChromaDB e EmbedAPI, executa as migrações e inicia worker e API, publicada apenas em `127.0.0.1`. A EmbedAPI utiliza PyTorch para CPU e mantém o modelo MiniLM multilíngue existente. O primeiro start baixa o modelo; as próximas inicializações reutilizam o volume `embedding_models`. ChromaDB também possui volume próprio. O banco não publica porta no host e seus dados ficam em volume próprio. O administrador inicial segue o comportamento existente da aplicação. Não use esse banco e suas credenciais de desenvolvimento em produção.

Após alterar a chave ou o modelo no `.env`, execute novamente o comando `up` acima para recriar os containers com o ambiente atualizado. No ambiente local, use `EMBEDDING_SERVICE_URL=http://embedding:8000` e `CHROMA_URL=http://chroma:8000`. Preencha `EMBEDDING_SERVICE_API_KEY` com a chave aceita pela EmbedAPI. Envie um material da turma e aguarde seu processamento antes de testar os modos RAG e a geração de quiz com documento. Os testes automatizados simulam o provedor e não consomem créditos.

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=100 backend worker
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

Com os serviços saudáveis e a OpenRouter configurada, o smoke test integrado usa contas, turma e documento temporários no PostgreSQL local. Ele realiza chamadas reais à OpenRouter e remove seus dados ao terminar:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T backend node - < load-tests/openrouter-rag-smoke.cjs
```

O teste cobre embeddings de 384 dimensões, autenticação, ingestão/reprocessamento, vetores no ChromaDB, teste RAG, streaming e jobs nos modos `none`, `context`, `self` e `hybrid`, quiz criado como rascunho com documento, insights/cache e remoção dos vetores.

O comando `down` preserva os volumes. Em produção, configure o banco e as integrações reais antes de usar o Compose principal.

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
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_TIMEOUT_MS=180000
OPENROUTER_TIMEOUT_CAP_MS=300000
OPENROUTER_MAX_CONCURRENCY=5
OPENROUTER_QUEUE_MAX_SIZE=100
OPENROUTER_QUEUE_TIMEOUT_MS=600000
AGENT_MAX_ATTEMPTS=3
AGENT_RETRY_DELAY_MS=1500
QUIZ_AI_GENERATION_TIMEOUT_MS=300000
DASHBOARD_INSIGHTS_TIMEOUT_MS=90000
SELF_RAG_DECISION_TIMEOUT_MS=60000
SELF_RAG_DECISION_QUEUE_TIMEOUT_MS=600000
SELF_RAG_FINAL_AGENT_TIMEOUT_MS=180000
SELF_RAG_FINAL_QUEUE_TIMEOUT_MS=600000
CHAT_GENERATION_JOB_TIMEOUT_MS=600000
CHAT_GENERATION_MAX_ATTEMPTS=1
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

## Idiomas da API

A API oferece português do Brasil (`pt-BR`), inglês (`en-US`) e espanhol (`es-ES`). As mensagens e os três prompts originais em português foram preservados. Os catálogos ficam em `src/i18n/catalogs/` e os prompts traduzidos em `prompts/en-US/` e `prompts/es-ES/`.

O idioma de cada requisição segue esta prioridade:

1. Header `X-Language`, para uma escolha explícita válida.
2. Preferência salva na conta, em rotas autenticadas e após o login.
3. Header `Accept-Language` enviado pelo navegador, respeitando os pesos `q`.
4. `pt-BR`, quando não houver idioma suportado.

Variantes como `en-GB` e `es-MX` usam `en-US` e `es-ES`. Um `X-Language` não suportado é ignorado; uma preferência não suportada enviada ao endpoint abaixo retorna 400. A resposta informa o idioma efetivo no header `Content-Language`. O CORS permite os headers de idioma e expõe esse header de resposta. `GET /languages` lista os três idiomas e negocia o idioma pelos headers; a preferência da conta é aplicada nas rotas autenticadas. A chave da API continua obrigatória quando configurada.

Para salvar a escolha do usuário autenticado:

```http
PATCH /account/preferences
Content-Type: application/json

{"language":"en-US"}
```

Use `{"language":null}` para voltar a seguir o navegador. O login e `GET /auth/me` incluem `preferredLanguage`. O frontend pode usar `X-Language` para aplicar imediatamente uma escolha e o endpoint de preferências para persistir essa escolha. Esta etapa implementa o contrato da API; a interface e o seletor visual ficam no frontend.

Mensagens de validação, permissões, confirmações e recuperação de senha têm versões nos três idiomas. Erros conhecidos incluem um `code` estável, independente da tradução. Logs e diagnósticos técnicos dos serviços continuam destinados à operação.

Chat, streaming, RAG e insights usam o idioma efetivo da requisição. Jobs salvam `outputLanguage` ao serem criados e mantêm esse idioma mesmo se a preferência da conta mudar antes da execução. A resposta do job e os metadados das novas respostas do assistente informam o idioma. O cache de insights é separado por idioma.

Na criação manual ou geração de quizzes (`POST /quiz/professor` e `POST /quiz/professor/generate-ai`), o campo opcional `language` escolhe o idioma do novo conteúdo; quando omitido, segue a requisição. Isso permite gerar um quiz em inglês mantendo as mensagens da interface em português. Quizzes existentes mantêm `language: null`, pois não é possível inferir seu idioma com segurança. Chaves JSON, enums, identificadores, respostas corretas e regras de avaliação continuam iguais.

Históricos, nomes, documentos, quizzes e prompts personalizados já salvos não são traduzidos nem reescritos. O RAG pode usar um material em português para responder em inglês ou espanhol, preservando as fontes e os identificadores do material. O idioma solicitado é uma instrução ao modelo; a qualidade e a adesão da geração continuam dependendo do provedor.

A migração `drizzle/0002_api_languages.sql` adiciona preferência, idioma dos jobs e dos novos quizzes e metadados de erros. Jobs legados recebem `pt-BR`. O Compose local aplica as migrações antes de iniciar API e worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build --wait --wait-timeout 180
docker compose --profile test run --build --rm tests npm test -- --silent
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T backend node - < load-tests/api-languages-smoke.cjs
```

O smoke integrado usa a OpenRouter configurada, PostgreSQL, Embedding e ChromaDB do Compose local, cria registros sintéticos e remove seus registros e vetores ao terminar. As chamadas reais ao modelo consomem a conta configurada. Não requer instalar dependências no host.

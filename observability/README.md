# LogiBot Observability

Stack local para diagnosticar gargalos do `/chat/messages` com Prometheus e Grafana.

## Backend

Inicie o backend com metricas habilitadas:

```bash
METRICS_ENABLED=true
METRICS_API_KEY=change-me
```

O endpoint `GET /metrics` exige:

```http
Authorization: Bearer change-me
```

## Prometheus + Grafana

Suba a stack a partir desta pasta:

```bash
METRICS_API_KEY=change-me BACKEND_METRICS_TARGET=host.docker.internal:43187 docker compose up -d
```

Por padrao, o Prometheus coleta `http://host.docker.internal:43187/metrics`
usando o token recebido em `METRICS_API_KEY`.

Grafana:

- URL: `http://localhost:43190`
- Usuario: `admin`
- Senha: `admin`
- Dashboard: `LogiBot / LogiBot Chat Bottlenecks`
- Porta interna do container: `43190`

Prometheus:

- URL: `http://localhost:43189`
- Porta interna do container: `43189`
- Use a tela `Status > Target health` para confirmar se o backend esta sendo coletado.
- A analise principal deve ser feita no Grafana; o Prometheus tem uma UI mais basica para consultas.

## k6

Rode a partir da pasta `LogiBot_Backend`.

Smoke test:

```bash
k6 run load-tests/chat-stress.js \
  -e BASE_URL=http://localhost:43187 \
  -e API_KEY= \
  -e K6_EMAIL=student@example.com \
  -e K6_PASSWORD=change-me \
  -e K6_PROFILE=smoke
```

Stress test:

```bash
k6 run load-tests/chat-stress.js \
  -e BASE_URL=http://localhost:43187 \
  -e API_KEY= \
  -e K6_EMAIL=student@example.com \
  -e K6_PASSWORD=change-me \
  -e K6_PROFILE=stress
```

Use `K6_MESSAGE` para trocar a pergunta e `K6_SLEEP_SECONDS` para controlar o
intervalo entre mensagens de cada VU.

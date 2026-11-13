# Sessões persistentes e contabilização de uso

## Comportamento implementado

- Sessões de autenticação revogáveis em `auth_sessions`, com `sid` assinado no JWT e validação no servidor em cada requisição protegida.
- Um login vigente por conta. Um novo login substitui o anterior; abas que compartilham o cookie usam o mesmo relógio. A interface sincroniza encerramentos e recarrega a identidade quando outra aba inicia uma sessão diferente.
- `SESSION_IDLE_SECONDS=1800`: expiração após 30 minutos sem interação registrada. Polling e respostas automáticas de IA não renovam esse prazo.
- `SESSION_ABSOLUTE_SECONDS=7200`: limite absoluto de duas horas, mantido mesmo com atividade. O cookie e o JWT usam a mesma política.
- `SESSION_SWEEP_CRON=* * * * *`: varredura a cada minuto no worker, com recuperação de pendências na inicialização, `noOverlap` e bloqueios de linhas no PostgreSQL para coordenação entre processos.
- `requireAuth` impede o retorno de uma sessão vencida mesmo se o worker estiver parado. O fechamento na validação é confirmado na transação antes de responder 401. Credenciais antigas sem `sid` exigem novo login.
- Expiração de um JWT assinado também fecha sua sessão persistente. Logout e login substituto revogam a sessão no servidor, não apenas o cookie.

## Tempo observado e histórico

O navegador envia checkpoints a cada 30 segundos quando há interação recente, sem enviar o texto digitado. A coleta considera teclado, digitação, toque, ponteiro e rolagem. Uma aba aberta sozinha não comprova uso ativo.

O servidor calcula os intervalos com seu relógio e limita a continuidade da observação a 60 segundos. Se houve uma pausa maior, a nova interação recomeça a observação sem preencher o intervalo offline. Duplicatas e chamadas de múltiplas abas são serializadas pelo mesmo registro de autenticação.

Os intervalos ficam em `session_activity_intervals` e a duração analítica é atualizada durante o uso. O encerramento nunca acrescenta a tolerância de inatividade ou o atraso da varredura aos segundos observados. A soma acumulada de sessões encerradas só é atualizada uma vez; o dashboard também apresenta checkpoints de sessões ainda abertas, sem inventar um horário de saída.

`duration_source` distingue:

| Valor | Significado |
| --- | --- |
| `observed` | Tempo calculado pelos checkpoints de interação desta implementação |
| `recorded` | Registro legado de duração da sessão; não representa necessariamente tempo ativo |
| `estimated` | Intervalo histórico reconstruído a partir de evidências, com auditoria |
| `unavailable` | Não há evidência de duração positiva suficiente |

Tempo observado não comprova atenção humana. Leitura ou reflexão sem eventos pode ficar fora da coleta; o aviso permite confirmar a continuidade da autenticação. A política de autenticação é distinta da medição de uso. Os dias de relatório continuam em **UTC**, conforme o contrato de filtros já existente. Checkpoints que atravessam meia-noite são divididos entre os dias, com preservação da soma de segundos.

Respostas de quiz, tentativa e contabilização analítica são gravadas na mesma transação, vinculadas à sessão autenticada aberta e ao ID permanente do aluno. Trocar o e-mail não interrompe esse vínculo. Uma sessão encerrada não pode ser selecionada por ser apenas a sessão mais recente.

## Interface

- Aviso dois minutos antes do limite, com distinção entre inatividade e limite absoluto.
- Confirmação de continuidade antes da inatividade vencer; depois do limite, novo login obrigatório.
- Em 401, limpeza do estado autenticado e dos caches privados e redirecionamento com motivo de expiração. O fluxo de chat com `fetch` também participa desse tratamento.
- Rascunhos não enviados de quiz e chat em `sessionStorage`, separados por conta e com validade de 24 horas; não são restaurados para outro usuário. Senhas não são armazenadas nesse mecanismo.
- Aviso com foco, sem fechar por Escape, navegação por teclado, rolagem interna e altura limitada à janela. Fontes em unidades relativas e ações com área mínima de 44 px. Há testes em 320 px com texto ampliado a 200% e verificação automatizada de acessibilidade.

O aviso acessível e os testes automatizados não equivalem a uma declaração de conformidade integral com a WCAG. O limite absoluto de segurança e a política de extensões devem continuar sendo avaliados junto aos requisitos de acessibilidade do produto.

## Migração e ativação

1. Criar `pg_dump -Fc`, conferir com `pg_restore --list` e guardar checksum SHA-256 fora do repositório.
2. Construir as imagens do backend e worker.
3. Aplicar `node dist/db/migrate.js` usando o ambiente de banco do backend. A migração `0005_session_lifecycle` cria as duas tabelas e os índices, sem recuperar histórico automaticamente. `0006_session_interval_constraints` impede encerramento anterior ao início e duração negativa.
4. Atualizar backend, worker e interface. Usuários com credenciais anteriores deverão entrar novamente.
5. Conferir `/health/simple` e o bloco `worker.sessions` de `/health` do worker: `lastSweepAt`, `expiredSessions` e `lastError`.

As variáveis de sessão ficam no ambiente do backend e do worker. O navegador recebe os prazos do servidor; não existe outra configuração de timeout independente no frontend.

## Recuperação histórica manual

`reconcile-session-history.cjs` trata sessões legadas abertas e sessões encerradas acima de duas horas, antigas há pelo menos 24 horas, ainda sem auditoria e sem vínculo com o mecanismo novo.

Primeiro executar sem argumentos para obter a prévia. Ensaiar em uma restauração isolada. Para aplicar, fornecer `--apply`, o checksum do backup conferido e o `planSha256` da prévia. Se o plano mudar, o script recusa a operação. O script preserva respostas e registra o estado anterior de cada sessão em `analysis_session_recoveries`.

Nas encerradas longas, o horário de logout não é aceito como prova de última atividade: são consultadas respostas, tentativas e mensagens enviadas pelo usuário, limitadas pelo encerramento original e pelo próximo login. Ausência de evidência não gera minutos artificiais. O resultado é sempre estimado ou indisponível. O cron não executa esse reparo nem reescreve dados históricos.

## Validação reproduzível

- `sessionLifecycle.integration.test.ts`: banco PostgreSQL isolado, login real por HTTP, revogação, limite absoluto, inatividade sem cron, concorrência, uso em andamento, quiz transacional e credenciais antigas.
- `studentSessionRecovery.integration.test.ts`: regressão do fechamento e das estimativas legadas.
- `observedUsage.test.ts`: divisão por dia e arredondamento sem criar segundos.
- `maintenance/verify-session-cron.cjs`: agenda real de um minuto, sem relógio simulado, após a varredura inicial. Cria e remove uma conta sintética somente em banco cujo nome contém `_usage_recovery_check_`.
- `session-lifecycle.spec.ts`: navegador desktop/mobile, polling sem renovar sessão, interação por teclado, aviso com texto em 200%, expiração, 401 e restauração do quiz após login.
- `useAccountDraft.test.tsx`: isolamento entre contas, prazo de retenção e preservação do chat após falha.

Não executar os testes de integração contra o banco em uso. `DATABASE_URL` e `SESSION_RECOVERY_TEST_DATABASE_URL` devem apontar para o mesmo banco isolado nos testes novos.


## Conferência da recuperação local em 12/11/2026

A aplicação local recuperou 80 sessões acadêmicas (38 abertas e 42 encerradas longas) e encerrou 2.765 sessões abandonadas de carga sem inventar duração. As 1.085 respostas analíticas e as 1.085 respostas de quiz foram preservadas. Os casos sem evidência continuam identificados como indisponíveis.

A validação detectou e corrigiu perda de microssegundos na versão inicial do reparo manual. O script definitivo calcula durações e mantém timestamps nativos no PostgreSQL. A correção foi ensaiada tanto em uma restauração original quanto no primeiro banco de ensaio já reparado; a auditoria retém os valores anteriores e a trilha da correção de precisão. `correct-recovery-precision.cjs` registra essa correção única. O início da sessão analítica nova também usa exatamente o mesmo timestamp da autenticação.

O scan posterior confirmou zero intervalos inválidos, zero sessões legadas abandonadas, zero durações legadas acima de duas horas e zero divergências nos totais. As restrições no banco impedem a reintrodução de intervalos negativos; o teste de integração tenta explicitamente encerrar uma sessão um microssegundo antes de seu início e recebe a rejeição do PostgreSQL.

Backup, plano nativo, auditoria e evidências locais ficam fora dos repositórios em `../../tmp/session-time-recovery-20261112/session-lifecycle-scan`, relativo a este documento. O backup original está no diretório pai dessa pasta. O histórico é reconstruído como estimativa, não convertido em medição de atenção. A VPS não foi alterada nesta implementação.

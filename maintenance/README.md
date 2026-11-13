# Recuperação de durações de sessões

A migração `0004_session_recovery_audit` cria metadados e auditoria. Ela não recupera sessões automaticamente.

O reparo histórico é uma operação manual, restrita ao curso escolhido. Primeiro gere e confira um `pg_dump -Fc`, protegido contra leitura por outros usuários, e registre seu SHA-256. Execute `preview-session-times.sql` com `-v course_id=<uuid>` e revise as contagens e durações.

Depois da revisão e autorização, execute `recover-session-times.sql` com as variáveis psql `course_id`, `expected_sessions`, `expected_seconds` e `backup_sha256`. O script recusa contagens ou totais diferentes da prévia, sessões recentes, durações prévias não nulas e intervalos acima de 24 horas. Uma segunda execução exige nova revisão, pois as sessões já estarão encerradas.

A estimativa usa o maior horário entre última atividade, última resposta e última tentativa diretamente ligadas à sessão, limitado pelo início da próxima sessão. Não usa a data de execução como encerramento e não mede tempo ativo. Sem evidência de duração positiva, a origem fica `unavailable`, com duração zero.

Os valores originais ficam em `analysis_session_recoveries.previous_state`, junto às evidências, ao identificador da execução e ao checksum do backup. As respostas dos quizzes não são alteradas. Os totais acumulados são reconciliados pelas durações das sessões encerradas.

As APIs identificam durações `recorded`, `estimated` e `unavailable`. A interface sinaliza estimativas no tempo de uso, nos detalhes de acesso e na matriz de esforço. Ao encerrar uma sessão sem atividade há mais de duas horas, o backend limita a duração à última atividade e identifica a estimativa; isso não equivale a uma coleta contínua de tempo ativo.

## Verificação isolada

Restaure o backup em um banco separado cujo nome contenha `_usage_recovery_check_`, aplique a migração e execute:

```bash
SESSION_RECOVERY_TEST_DATABASE_URL='<URL do banco isolado>' npm test -- --runTestsByPath src/__tests__/studentSessionRecovery.integration.test.ts
```

Os testes conferem encerramento recente, sessão abandonada, ausência de evidência e chamadas concorrentes. O reparo deve ser ensaiado nesse banco antes de ser executado no banco em uso.

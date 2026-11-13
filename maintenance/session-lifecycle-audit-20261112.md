# Diagnóstico de sessões e proposta de controle de tempo

Data: 12/11/2026, 22:18, America/Belem.

## Escopo e método

Scan do banco **local**, em transação `REPEATABLE READ READ ONLY`, sem alteração de dados ou de serviços. A VPS não foi consultada nesta análise. Dados agrupados por escola, curso e turma, sem nomes e e-mails individuais.

Evidências reproduzíveis em `../../tmp/session-time-recovery-20261112/session-lifecycle-scan/scan.json` e `scan.cjs`, relativos a este documento. O script lê o banco pelo contêiner backend local. O JSON registra o instante UTC da consulta.

Foram confrontados início, encerramento, duração, última atividade, última tentativa e última resposta de quiz vinculada à sessão. O intervalo até a última evidência não mede tempo ativo. Os nomes dos cursos não demonstram por si só a origem real ou sintética dos registros. As turmas explicitamente identificadas como testes de carga foram separadas.

## Constatações nos dados

| Escola / curso | Sessões | Abertas antigas | Abertas com respostas | Respostas nessas abertas | Encerradas acima de 2 h |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gaspar Viana / Terceiro Ano Técnico | 56 | 15 | 3 | 75 | 26 |
| IFPA / I2261TI | 29 | 13 | 8 | 130 | 3 |
| Universidade LogiBot / Sistemas de Informação | 43 | 10 | 0 | 0 | 13 |
| IFPA / I2261M1 | 23 | 0 | 0 | 0 | 0 |
| Escola de Testes de Carga / Curso de Testes | 4.009 | 2.765 | 0 | 0 | 0 |

- Fora das turmas de carga, **38 sessões abertas antigas** em 12 turmas. Todas têm última evidência há mais de duas horas; os registros são de agosto de 2026.
- **11 dessas sessões têm 205 respostas de quiz e duração zerada**. Esse é o mesmo mecanismo que ocultava o tempo de I2261M1.
- Entre as 38 abertas, 26 têm evidência de intervalo positivo e 12 não têm. A soma preliminar dos intervalos até a última evidência é 78.298 segundos, **21 h 44 min 58 s agregados**, nunca uma medida de tempo ativo. Nenhuma dessas estimativas foi gravada.
- **42 sessões encerradas excedem duas horas**, das quais 26 excedem 24 horas. A maior tem 877.751 segundos, **10 dias, 3 h, 49 min e 11 s**. São indícios de inflação do tempo de uso, não prova individual da duração real de estudo.
- Nas 42 sessões longas, `last_activity_at` coincide com `session_end`; esse campo isoladamente não permite reconstruir a última interação anterior ao logout. Revisar tentativas, respostas e mensagens antes de propor reparo.
- As 2.765 abertas de carga pertencem a três usuários de teste; são os únicos usuários com múltiplas sessões abertas. Há também 114 sobreposições entre sessões encerradas nesse conjunto. Não usar esses dados como comportamento acadêmico.
- Os totais acumulados coincidem com a soma das sessões encerradas: a falha é principalmente no ciclo de vida/coleta, não uma divergência entre duas somas. Não foram encontrados intervalos negativos, respostas posteriores ao encerramento ou sessões encerradas com respostas e duração zero no snapshot.
- Há 20 perfis de estudante sem `user_analyses`. Isso pode representar usuários que nunca acessaram; não classificar automaticamente como perda de tempo.
- I2261M1 mantém a recuperação local anterior: 23 sessões encerradas, 22 estimadas, uma sem evidência de duração positiva, total de 87.385 segundos e 340 respostas preservadas. Isso não demonstra o estado atual da VPS.

## Causas no código atual

1. `src/http/auth.ts`: JWT expira duas horas após a emissão, independentemente da atividade. `requireAuth` valida JWT e conta, mas não consulta uma sessão persistente revogável com limite de inatividade.
2. `src/http/cookies.ts`: cookie também tem duração fixa de duas horas. Expiração do JWT/cookie não encerra por si só a sessão analítica.
3. `../LogiBot_Frontend/src/app/providers/AuthProvider.tsx`: outro relógio, de duas horas sem eventos do navegador. Ele depende da aba continuar executando e pode tentar `/auth/logout` quando o JWT já expirou.
4. `src/routes/modules/authRoutes.ts`: logout exige `requireAuth`; uma credencial expirada pode ser rejeitada antes do fechamento analítico. Limpar apenas o cookie tampouco revoga um JWT copiado ainda válido.
5. `../LogiBot_Frontend/src/shared/api/httpClient.ts`: resposta 401 apenas gera log; não limpa automaticamente o estado autenticado da interface.
6. `src/services/analytics/analyticsService.ts`: tempo de uso só é somado quando há `session_end` e duração positiva. `src/services/dashboard/dashboardService.ts` também exclui abertas dos detalhes. Não existe acompanhamento provisório de tempo ativo em andamento.
7. `src/db/repositories/authRepository.ts`: novo login fecha uma sessão e cria outra em operações separadas. Falta serialização/garantia de unicidade para a política de sessões adotada. `saveStudentQuizResult` busca a sessão mais recente sem exigir que esteja aberta ou vinculada à credencial da requisição.
8. `src/routes/modules/analyticsRoutes.ts`: atualização da última atividade depende de algumas interações categorizadas. Leitura, navegação e outras ações não têm coleta uniforme. `chat_sessions.last_activity_at` é outro campo, separado de `analysis_sessions`.
9. `src/db/repositories/studentSessionRepository.ts`: o fechamento local anterior limita sessões abandonadas à última atividade após duas horas e evita contabilização duplicada da sessão selecionada. É uma mitigação no fechamento; não há rotina periódica, revogação de autenticação ou medição contínua.
10. `node-cron` consta nas dependências, mas não foi encontrado agendamento de expiração no código de inicialização do backend/worker.

## Solução proposta para implementação local

### Relógios com funções diferentes

| Parâmetro inicial proposto | Valor | Função |
| --- | --- | --- |
| Coleta de atividade | a cada 30 s quando há interação recente | Persistir checkpoints sem escrever a cada evento |
| Janela máxima de contribuição por amostra | 60 s | Não converter um intervalo longo sem evidência em tempo ativo |
| Inatividade para exigir login | 30 min, configurável | Revogar a sessão quando não há atividade humana recente |
| Aviso de inatividade | 2 min antes | Permitir continuar a sessão com ação acessível |
| Varredura de sessões | a cada 1 min | Fechar sessões abandonadas mesmo com navegador fechado |
| Limite absoluto | manter inicialmente as 2 h atuais | Exigir nova autenticação mesmo havendo atividade, com aviso e preservação do trabalho |

Valores são proposta, não configuração já aplicada. Coleta periódica não deve renovar autenticação apenas porque um timer disparou. Também não se deve confundir falta de resposta ao quiz com inatividade: leitura, digitação e navegação por teclado contam como interação. Uma aba visível sozinha não comprova atenção; períodos de leitura sem eventos exigem confirmação antes do encerramento. A telemetria estima engajamento observável, não comprova atenção humana.

### Backend e banco

1. Criar sessão de autenticação persistente com identificador aleatório, conta, início, última atividade, expiração por inatividade, expiração absoluta, encerramento e motivo. Vincular o JWT a essa sessão (`sid`) e, para estudantes, vincular a sessão analítica ao mesmo identificador. Não reutilizar a tabela exclusivamente estudantil para autenticar todos os papéis.
2. Usar horário do servidor. Em toda requisição protegida, verificar a sessão **antes** de atualizar atividade. Expirada ou revogada deve receber 401 e nunca ser reativada por heartbeat ou resposta atrasada, mesmo que o cron não tenha executado.
3. Registrar checkpoints/intervalos de uso observado, com deduplicação e limites de duração. Não somar `agora - login` como tempo ativo. Separar `active_usage_seconds` da duração decorrida da sessão e das estimativas históricas.
4. Criar o agendamento `* * * * *` no worker, com `noOverlap` e coordenação pelo PostgreSQL entre instâncias. Executar recuperação de pendências também na inicialização. Garantir transação e idempotência no encerramento e na atualização dos totais.
5. Ao expirar, revogar autenticação e fechar a sessão analítica correspondente. Persistir motivo (`idle_timeout`, `absolute_timeout`, `logout`, etc.) e o limite lógico de encerramento, sem acrescentar o atraso de até um minuto da varredura ao tempo medido. Uso ativo encerra no último checkpoint elegível; duração da sessão pode incluir a tolerância de inatividade, identificada separadamente.
6. Vincular respostas e demais eventos à sessão da requisição, com validação transacional para impedir escrita em sessão encerrada. Incluir gravação do quiz e alimentação analítica na mesma unidade consistente; não deixar uma tentativa salva sem sua contabilização por falha intermediária.
7. Definir explicitamente a política entre dispositivos. Abas que compartilham a mesma credencial devem compartilhar o relógio, sem duplicar segundos. Se dispositivos simultâneos forem permitidos, totais por aluno devem considerar união de intervalos, evitando contagem dobrada.
8. Expor uso em andamento como provisório, somado de checkpoints válidos sem inventar `session_end`. Revisar gráfico diário, matriz de esforço, exportações e insights; intervalos que atravessam meia-noite precisam ser repartidos por dia no fuso de relatório.

### Interface e acessibilidade

1. Coletar eventos de interação com limitação de frequência; não enviar conteúdo digitado. Coordenar abas para evitar contribuição duplicada e não renovar por polling de dashboard ou respostas automáticas de IA.
2. Sincronizar prazos com o servidor; ao voltar de suspensão, revalidar antes de permitir envio. Rede indisponível não deve ser tratada como logout confirmado nem transformar todo o período offline em uso ativo.
3. Avisar antes da expiração com teclado, foco, leitor de tela e texto ampliado. Oferecer ação simples para continuar antes do limite de inatividade, com extensões suficientes conforme o critério de tempo ajustável. O limite absoluto exige estratégia própria de reautenticação e conservação de respostas/rascunhos.
4. Em 401 por expiração/revogação, limpar o estado autenticado e caches privados, sincronizar abas e encaminhar para login com explicação. Não reenviar automaticamente uma operação de quiz depois de autenticar sem verificar se já foi gravada.
5. Preservar de forma apropriada o trabalho não enviado, com proteção por conta, limpeza e prazo de retenção, sem expor respostas a outro usuário no mesmo navegador.

### Histórico existente

- O mecanismo futuro não corrige automaticamente agosto de 2026.
- Gerar novo backup e checksum antes de qualquer reparo, ensaiar em banco isolado e registrar valores anteriores, evidências e motivo.
- Tratar separadamente: 38 abertas acadêmicas; 42 encerradas longas suspeitas; 2.765 abertas de carga. A rotina de recuperação atual contempla apenas abertas, não resolve encerradas infladas.
- Nas abertas com evidência, apresentar intervalo estimado como tal. Nas 12 sem evidência de intervalo positivo, não inventar minutos.
- Não aplicar retrospectivamente a política futura de 30 minutos como se ela tivesse sido medida no passado. Eventos espaçados podem representar estudos separados ou pausas; revisar por sessão antes de propor valor.
- Manter respostas, acertos e erros intactos. Não excluir dados de carga sem decisão explícita.

## Ordem de execução e critérios de aceite

1. **Política e modelo:** definir limites e a semântica de tempo; criar migração compatível e contratos de API, incluindo estratégia para credenciais antigas sem `sid`.
2. **Servidor:** persistência, validação, coleta, encerramento atômico e cron; testar timeout sem cron, cron duplicado, reinício, concorrência com login/logout/quiz e revogação de token antigo.
3. **Interface:** heartbeat condicionado, aviso acessível, 401, múltiplas abas, suspensão e rascunhos; testar teclado, leitor de tela, ampliação e desconexão.
4. **Analytics:** uso provisório e consolidado, dia/fuso, união de intervalos e identificação das estimativas antigas; conferir que varreduras repetidas não aumentam totais.
5. **Histórico:** backup novo, plano por sessão, revisão e ensaio de recuperação; conferir contagem de respostas antes/depois e capacidade de desfazer pelo registro de auditoria.
6. **Homologação local:** simular leitura, digitação, ausência, fechamento de navegador e retorno após o limite; sessão expirada só volta a funcionar depois de novo login. Publicação na VPS permanece uma etapa posterior.

## Referências

- [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): expiração por inatividade e absoluta aplicadas no servidor; fechamento de navegador não é garantia de logout.
- [node-cron — Scheduling options](https://www.nodecron.com/scheduling-options.html): `noOverlap` evita sobreposição da tarefa local; coordenação no banco deve cobrir múltiplas instâncias. Conferir API disponível na versão efetivamente instalada antes da implementação.
- [W3C — WCAG 2.2, Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html): permitir ajustar ou estender limites; no caminho de extensão, aviso com pelo menos 20 segundos e pelo menos dez extensões, salvo exceções aplicáveis. A proposta de aviso de dois minutos não dispensa os outros requisitos.

Estado final deste levantamento: **scan concluído, proposta documentada; nenhuma nova recuperação, configuração de timeout, implementação de cron ou alteração na VPS foi aplicada**.

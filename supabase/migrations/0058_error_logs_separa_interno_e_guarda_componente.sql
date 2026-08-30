-- `error_logs` existe desde a 0046 para responder "o que quebrou para o
-- CLIENTE". Lida em 30/08, ela tinha 73 registros e **nenhum de cliente
-- externo**: 67 vindos de localhost (servidores do próprio agente durante os
-- testes), 4 da conta de demonstração e 2 da conta do dono.
--
-- 92% de ruído. O custo não é disco: uma fila com 70 linhas de lixo ensina a
-- ignorar a fila inteira, e junto com o item chato vai embora o erro que
-- importa. É a mesma lição que a Central do Dono pagou em 20/08, quando 8 de
-- 11 alertas eram e-mails de teste e a fila só voltou a ser lida depois de
-- cair para 4.
--
-- Esta migration não apaga nada. Ela dá à tabela as duas colunas que faltavam
-- para separar sinal de ruído; a regra de gravação vive na rota
-- (`app/api/log-erro/route.ts`), que é onde a informação existe.

-- Erro do dono e da conta de demonstração continua sendo gravado, e isso é
-- decisão: foi um registro desses, de `origem: global`, que resolveu a tela
-- preta de 24/08 — descartá-lo teria custado a investigação inteira. O que
-- muda é que ele deixa de se misturar com erro de cliente.
alter table public.error_logs
  add column if not exists interno boolean not null default false;

-- O `stack` que o navegador entrega em produção é minificado e não nomeia
-- nenhum arquivo do projeto:
--
--     at ik (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:110229)
--     at nf (.../chunks/fd9d1056-b58fad7d2523e3e9.js:1:26357)
--
-- Foi por isso que os dois "React #185" de 20/08 e 22/08 no /kanban ficaram
-- sem diagnóstico: sabe-se que houve loop de setState e não se sabe em qual
-- componente. O React entrega essa informação de graça no segundo argumento
-- do error boundary — `componentStack` traz a árvore por NOME, legível mesmo
-- minificada. Ela só nunca foi capturada.
alter table public.error_logs
  add column if not exists component_stack text;

comment on column public.error_logs.interno is
  'Erro de conta nossa (dono ou demonstração), não de cliente. Gravado de propósito, separado de propósito.';

comment on column public.error_logs.component_stack is
  'Árvore de componentes React por nome. É o que torna um erro minificado diagnosticável.';

-- O índice de leitura útil: erro de cliente, do mais recente para o mais
-- antigo. Parcial porque a pergunta que se faz a esta tabela é sempre sobre
-- cliente — o registro interno fica disponível para consulta direta, sem
-- ocupar espaço no índice do caminho quente.
create index if not exists error_logs_externos_idx
  on public.error_logs (created_at desc)
  where interno = false;

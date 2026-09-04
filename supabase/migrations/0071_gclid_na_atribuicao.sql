-- `gclid`: o identificador de clique do Google, guardado hoje porque amanhã
-- não dá para guardá-lo retroativamente.
--
-- ## O buraco que isto fecha, e por que ele é o MESMO de 03/09
--
-- `components/landing/utm-capture.tsx` captura `fbclid` desde que a atribuição
-- existe, e nunca capturou `gclid`. Enquanto não havia campanha de busca isso
-- não custava nada. Passou a custar em 04/09, com o Google Ads entrando como
-- plano B do bloqueio da Meta.
--
-- É a migration 0069 se repetindo com outro nome: lá, o banco não guardava
-- qual PEÇA trouxe o cliente e o teste de seis ângulos rodaria sem concluir
-- nada. Aqui, o banco não guarda o identificador de clique e a pergunta que
-- fica sem resposta é a que mais importa.
--
-- ## A pergunta que só o `gclid` responde
--
-- O relatório do Google Ads sabe quem CLICOU e quem se cadastrou. O que ele
-- não sabe é quem PAGOU: a assinatura acontece dias depois, no Asaas, fora do
-- alcance de qualquer tag do navegador.
--
-- O caminho oficial para fechar isso é a importação de conversão offline —
-- mandar de volta ao Google "este clique virou R$ 49/mês em tal data". Ela
-- exige exatamente um dado: o `gclid` daquele clique.
--
-- **A importação em si NÃO entra nesta rodada.** Ela pede OAuth, developer
-- token e aprovação do Google, o que leva semanas. Mas ela é impossível sem
-- histórico, e histórico não se cria depois: cada dia rodando sem esta coluna
-- é um dia de cliques que nunca poderão ser reconciliados com o dinheiro que
-- eles trouxeram. A coluna custa uma migration; o dado perdido custa a única
-- medição que fecha o ciclo.
--
-- ## Nasce anulável e sem índice, pelos mesmos motivos da 0069
--
-- Anulável porque a imensa maioria das visitas não vem de anúncio nenhum, e
-- string vazia mentiria dizendo que veio. Sem índice porque a Central agrupa
-- dezenas de linhas, não milhões — o índice entra junto da consulta que o
-- justificar, que hoje não existe.
--
-- ## Não entra em `proteger_colunas_do_workspace`
--
-- A 0027 trava `plan`, `id`, `created_by` e `created_at` contra edição direta,
-- porque mexer nelas é privilégio ou dinheiro. `gclid` é metadado de
-- marketing, no mesmo grupo dos `utm_*` e do `fbc`/`fbp` que já são gravados
-- por `update` comum em `lib/onboarding/actions.ts`. Trancá-lo aqui obrigaria
-- a passar por RPC para gravar um campo que, forjado, no máximo suja o
-- relatório do próprio dono.

alter table public.workspaces
  add column if not exists gclid text;

comment on column public.workspaces.gclid is
  'Identificador de clique do Google Ads (gclid da URL). Nulo quando a visita '
  'não veio de anúncio de busca. Gravado por components/landing/utm-capture.tsx, '
  'e é o dado que a importação de conversão offline vai exigir para dizer ao '
  'Google quais cliques viraram assinatura paga.';

-- ============================================================================
-- A pesquisa de mercado do lado do CLIENTE sai
-- ============================================================================
--
-- Decisão do dono, 08/09/2026, depois de perguntar quanto o recurso custaria
-- com clientes de verdade. A resposta mostrou uma conta ruim e um risco que o
-- dinheiro nem era o maior:
--
--     teto por empresa      R$ 30,00/mes sobre um ticket de R$ 49,00
--     uso ate hoje          ZERO. `enriquecimento_de_lead` e
--                           `sinal_de_mercado` nunca tiveram uma linha desde
--                           que nasceram, em 06/09
--     custo de LGPD         um suboperador FORA DO BRASIL declarado na
--                           Politica de Privacidade, recebendo nome e dominio
--                           da empresa contato de cada cliente
--
-- Carregar transferência internacional de dado de titular por um caminho que
-- ninguém percorreu uma vez é obrigação sem contrapartida. O recurso volta se
-- um cliente pedir — o código inteiro está no Git, e esta migration nomeia o
-- caminho de volta.
--
-- ## O que NÃO sai, e é a distinção que importa
--
-- A **prospecção do dono** continua inteira: `dominio/prospeccao.ts`,
-- `abordagem.ts`, `aprendizado.ts`, `decisor.ts`, o `prospectar.mjs` e a
-- prateleira em `/dono/prospeccao`. Ela usa o Exa sobre empresas que ainda não
-- são contato de ninguém, roda por script, e não trata dado de titular deste
-- produto.
--
-- Conferido antes de apagar, por importação e não por suposição: nenhum dos
-- quatro arquivos do lado do dono importa nada do lado do cliente, e o
-- `prospectar.mjs` tem o próprio `fetch` para `api.exa.ai`.
--
-- ## Por que `drop` e não `deprecated`
--
-- As duas tabelas têm zero linhas. Não há dado a preservar, e tabela vazia com
-- RLS e policies é superfície que alguém precisa entender de novo toda vez que
-- ler o schema. O `docs/schema.md` volta a 18 tabelas.
--
-- A ordem importa: `sinal_de_mercado` referencia `leads` e `workspaces`, e
-- `enriquecimento_de_lead` idem. Nenhuma das duas é referenciada por terceiro,
-- então a queda é direta.
-- ============================================================================

drop table if exists public.sinal_de_mercado;
drop table if exists public.enriquecimento_de_lead;

-- ============================================================================
-- O tipo de notificação volta ao que era antes da 0073
-- ============================================================================
--
-- `sinal_de_mercado` era o único consumidor. Deixar o valor no `check` sem
-- nada que o grave é o mesmo "código morto com aparência de recurso" que a
-- 0066 recusou ao não criar `whatsapp_caiu`.
--
-- Nenhuma linha existente usa o valor — as notificações desse tipo nunca
-- chegaram a ser gravadas, porque nenhum sinal foi produzido. O `check` novo
-- não pode reprovar nada que já esteja lá.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;

alter table public.notificacoes
  add constraint notificacoes_tipo_check check (
    tipo in (
      'pagamento_confirmado',
      'pagamento_atrasado',
      'plano_vencendo',
      'trial_terminando'
    )
  );

comment on table public.notificacoes is
  'Avisos do produto dentro da tela. Leitura por membro da empresa; update '
  'restrito por GRANT as colunas lida_em e dispensada_em (0074). Purga de 90 '
  'dias. O tipo sinal_de_mercado saiu na 0075, junto com a pesquisa de '
  'mercado do lado do cliente.';

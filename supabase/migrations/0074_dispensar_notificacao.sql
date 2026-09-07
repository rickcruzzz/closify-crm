-- 0074 — dispensar aviso, e a trava de coluna que a 0066 prometeu e não fez
--
-- Duas coisas, e a segunda foi achada ao implementar a primeira.
--
-- ## 1. `dispensada_em`: sair da lista sem apagar a linha
--
-- Hoje o sino só sabe "lida". Lida continua ocupando espaço na lista, e a
-- pessoa que já resolveu o assunto não tem como tirá-lo da frente. O resultado
-- é a lista crescer até os 90 dias da purga, e uma lista que só cresce é a
-- mesma que ensina a ignorar o sino — a lição de 20/08, quando 8 dos 11
-- alertas da Central eram ruído e o alerta de dinheiro foi ignorado junto.
--
-- **Coluna e não `delete`.** Apagar exigiria uma policy de DELETE para
-- `authenticated`, e a 0066 recusa isso pelo mesmo motivo que recusa `insert`:
-- quem pode apagar aviso de cobrança pode esconder um. Com a coluna, a linha
-- continua no banco, some da tela, e a purga de 90 dias segue sendo a única
-- coisa que remove de verdade.
--
-- ## 2. A promessa que a 0066 escreveu e não cumpriu
--
-- O comentário dela diz, em texto: *"update só da própria linha, e o único
-- campo que muda é `lida_em`"*. **A RLS não restringe COLUNA** — ela decide
-- quais LINHAS um papel alcança. E não havia nenhum `grant update (coluna)`.
--
-- Consequência real, medida ao ler o esquema: um membro autenticado podia
-- mandar um `PATCH` no PostgREST reescrevendo `titulo` e `corpo` de um aviso
-- existente. A 0066 recusa `insert` porque "notificação forjável é aviso de
-- cobrança forjável" — e o `update` aberto alcançava quase o mesmo resultado,
-- por outra porta.
--
-- A correção é a que este projeto já pagou uma vez, em `integration_connections`
-- (0034): **revogar na tabela inteira e conceder de volta só nas colunas
-- seguras.** Revogar uma coluna sozinho não subtrai de um grant mais amplo já
-- concedido por default privilege — foi assim que `access_token_enc` ficou
-- legível apesar do `revoke` explícito.

alter table public.notificacoes
  add column if not exists dispensada_em timestamptz;

comment on column public.notificacoes.dispensada_em is
  'Quando a pessoa tirou o aviso da lista. A linha permanece; quem remove de '
  'verdade e a purga de 90 dias. Nao existe policy de delete para authenticated.';

-- O índice do contador precisa da nova condição: dispensado não conta, e sem
-- isso o número no sino continuaria acusando o que já saiu da tela.
drop index if exists notificacoes_nao_lidas;
create index if not exists notificacoes_nao_lidas
  on public.notificacoes (workspace_id, user_id)
  where lida_em is null and dispensada_em is null;

-- ============================================================================
-- A trava de coluna
-- ============================================================================
--
-- Ordem importa: revogar primeiro na tabela, conceder depois nas duas colunas.
-- O caminho inverso deixaria o grant amplo de pé.
revoke update on public.notificacoes from authenticated;
grant update (lida_em, dispensada_em) on public.notificacoes to authenticated;

comment on table public.notificacoes is
  'Avisos do produto dentro da tela. Leitura por membro da empresa; update '
  'restrito por GRANT as colunas lida_em e dispensada_em (0074) — a 0066 '
  'prometia isso em texto e nao impunha. Purga de 90 dias.';

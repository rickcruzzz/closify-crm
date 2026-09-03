-- `utm_content`: qual PEÇA trouxe o cliente, e não só qual campanha.
--
-- ## O buraco que isto fecha
--
-- `workspaces` guarda `utm_source`, `utm_medium`, `utm_campaign`, `fbc` e
-- `fbp` desde que a atribuição existe. Falta o campo que diz qual CRIATIVO
-- converteu.
--
-- Isso não era problema enquanto nenhuma campanha rodava. Passou a ser em
-- 03/09, ao montar a campanha do Meta: ela é um teste de SEIS ângulos, cada um
-- com um mecanismo psicológico distinto — ancoragem de preço, aversão à perda,
-- viés de status quo, prova por demonstração, energia de ativação e efeito
-- preço zero. Os seis anúncios apontam para o mesmo `/cadastro`, distinguidos
-- só por `utm_content=a1_ancora_preco`, `a2_perda_memoria`, e assim por
-- diante.
--
-- Sem esta coluna, esse parâmetro chega na URL e é DESCARTADO. O resultado
-- seria saber que o cliente veio do Meta, da campanha de aquisição — e não
-- saber qual argumento o convenceu. Ou seja: o teste rodaria e não concluiria
-- nada, que é a pior forma de gastar dinheiro em anúncio.
--
-- ## Por que não basta o relatório da Meta
--
-- A Meta mostra qual anúncio teve mais cliques e mais cadastros. O que ela não
-- sabe é quem PAGOU — a assinatura acontece dias depois, no Asaas, e o
-- `Purchase` que a CAPI envia não carrega de volta qual criativo originou a
-- conta.
--
-- O cruzamento "qual peça trouxe quem virou Pro" só existe do nosso lado, e
-- só se a peça estiver gravada aqui. É a diferença entre otimizar por clique
-- barato e otimizar por cliente que paga.
--
-- ## Nasce anulável e sem índice, de propósito
--
-- Anulável porque a imensa maioria das visitas não vem de campanha nenhuma, e
-- string vazia mentiria dizendo que veio.
--
-- Sem índice porque a Central agrupa dezenas de linhas, não milhões — índice
-- aqui seria custo de escrita para uma leitura que varre a tabela inteira de
-- qualquer jeito. Quando a base crescer, o índice entra junto da consulta que
-- o justificar.

alter table public.workspaces
  add column if not exists utm_content text;

comment on column public.workspaces.utm_content is
  'Qual criativo/peça trouxe o cliente (utm_content da URL). Nulo quando a '
  'visita não veio de campanha. Gravado por components/landing/utm-capture.tsx.';

-- A mensagem que falhou ao sair passa a ter retentativa.
--
-- ## O que existia, e o que faltava
--
-- `lib/conversas/actions.ts` ja faz o certo: grava a linha como `pendente`,
-- tenta entregar, e marca `falhou` com o motivo quando o provedor recusa. O
-- dado NAO se perde.
--
-- O que nao existia era a segunda tentativa. Uma indisponibilidade de trinta
-- segundos da Z-API deixava a mensagem parada para sempre, e num produto cuja
-- promessa e nao perder venda por esquecimento, quem esquece passa a ser o
-- produto.
--
-- ## Uma coluna, e ela e o contador de tentativas
--
-- `proxima_tentativa_em` seria o desenho obvio e foi recusado: ele guarda uma
-- DATA derivada, e data derivada e o defeito da 0091, onde `current_period_end
-- + carencia` dava "ainda na carencia" para sempre depois de uma troca de
-- plano. O contador e um fato observado; a espera sai dele por funcao pura,
-- em `lib/whatsapp/reenvio.ts`, com teste.
--
-- ## O indice e PARCIAL, e o predicado e a fila inteira
--
-- A fila e "saiu de nos, falhou, e o provedor NUNCA aceitou". `external_id`
-- nulo e a terceira condicao e a mais importante: se a Z-API devolveu
-- `zaapId`, ela aceitou, e reenviar mandaria a MESMA mensagem duas vezes para
-- o cliente. Aceitar nao e entregar, mas aceitar e o bastante para nao repetir.
--
-- Sem o predicado, o indice cobriria as ~80 mil linhas de `mensagens` de uma
-- empresa ativa para achar as duas que interessam.
alter table public.mensagens
  add column if not exists tentativas smallint not null default 0;

comment on column public.mensagens.tentativas is
  'Quantas vezes o envio foi tentado. A espera ate a proxima sai daqui por funcao pura (lib/whatsapp/reenvio.ts), nunca de uma data gravada.';

create index if not exists mensagens_fila_de_reenvio_idx
  on public.mensagens (created_at)
  where direcao = 'enviada'
    and status = 'falhou'
    and external_id is null;

-- `tentativas` nasce FORA de qualquer grant novo: a 0056 concedeu `select` na
-- tabela para `authenticated`, entao a coluna e legivel como as outras de
-- `mensagens`. Isso e correto aqui, ao contrario de `whatsapp_instances`: nao
-- ha segredo nenhum num contador, e a tela do cliente pode querer dizer
-- "tentando de novo" um dia.

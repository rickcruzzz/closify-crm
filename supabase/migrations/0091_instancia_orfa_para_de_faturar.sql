-- A instância deixa de faturar quando o Max cai.
--
-- ## O buraco, e ele é de dinheiro recorrente
--
-- A 0090 blindou a CRIAÇÃO: instância que não consegue virar linha no banco é
-- apagada no provedor antes de a Server Action devolver o erro, porque
-- instância sem linha é cobrança invisível para toda tela e toda purga.
--
-- Ela não blindou a SAÍDA. Cliente assina o Max, conecta o número, e para de
-- pagar no mês seguinte. `max_vigente()` cai e ele deixa de enviar, o que está
-- certo. E a instância **continua faturando R$ 99,99 por mês, para sempre**,
-- até alguém olhar a fatura do provedor e perguntar de quem é aquele número.
--
-- É o mesmo defeito que a criação já evitava, do outro lado do ciclo de vida.
--
-- ## Por que uma COLUNA e não uma conta sobre `subscriptions`
--
-- O primeiro desenho derivava a data: `current_period_end + graça + 7 dias`.
-- Ele tem um furo real — **troca de plano**. Quem sai do Max para o Pro fica com
-- `current_period_end` válido e no futuro, e a conta diria "ainda na carência"
-- para sempre. A instância nunca seria apagada.
--
-- A coluna guarda o fato observado: *desde quando esta empresa está sem Max*.
-- É a mesma forma de `vigia_ultimo_aviso` (0062), e pelo mesmo motivo: memória
-- explícita do que já foi visto, em vez de reconstruída por aritmética sobre
-- outra tabela que responde outra pergunta.
--
-- ## Sete dias, e o número tem razão
--
-- `max_vigente()` já inclui `dias_de_graca()`, que cobre a compensação bancária
-- de boleto e Pix. Quando ele cai, essa carência JÁ correu.
--
-- Os sete dias daqui são uma segunda carência, e ela existe por um custo que
-- não é financeiro: **reconectar exige pegar o celular e ler um QR de novo**.
-- Cortar a instância de quem teve o cartão recusado numa terça e pagou na
-- quinta transformaria um atraso de dois dias em trabalho manual do cliente.
--
-- Uma semana de uma instância custa cerca de R$ 23. É barato contra a chance de
-- fazer um cliente que voltou parear o número outra vez.
--
-- ## Três ramos, e o terceiro é o que todo mundo esquece
--
--     sem Max e sem marca      marca a data. Nada e apagado hoje
--     sem Max ha mais de 7d    apaga no provedor e esquece a linha
--     COM Max e com marca      LIMPA a marca
--
-- Sem o terceiro, quem atrasa e volta a pagar carrega uma marca velha, e o
-- próximo atraso de um dia soma com a espera do anterior: a instância morre
-- por uma conta que ninguém escreveu.

alter table public.whatsapp_instances
  add column if not exists sem_max_desde timestamptz;

comment on column public.whatsapp_instances.sem_max_desde is
  'Desde quando esta empresa esta sem max_vigente. Escrito e LIMPO pela purga diaria, que apaga a instancia no provedor depois de 7 dias. Nulo quer dizer que o plano esta em dia.';

-- A purga varre por esta coluna, e só as linhas marcadas interessam. Parcial
-- pela mesma razão de `conversas_espera_idx`: um índice que não carrega linha
-- inútil é menor e mais rápido de varrer, e a esmagadora maioria das instâncias
-- está com o plano em dia.
create index if not exists whatsapp_instances_sem_max_idx
  on public.whatsapp_instances (sem_max_desde)
  where sem_max_desde is not null;

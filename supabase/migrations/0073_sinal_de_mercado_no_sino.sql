-- 0073 — o sinal de mercado entra no sino
--
-- A 0066 fechou `notificacoes.tipo` com um `check` e escreveu o motivo: "entrar
-- na lista vira decisão". Esta migration é essa decisão, tomada de propósito
-- num arquivo separado e não de carona na 0072.
--
-- ## Por que ele passa no critério, e os dois que não passaram
--
-- O critério da 0066 é único: **só vira notificação o que já provou valer um
-- e-mail** — e a metade mais importante dele é o que NÃO entra, nada do que a
-- própria pessoa acabou de fazer.
--
-- Sinal de mercado passa nos dois lados. Ele não é ação da pessoa: nasce de uma
-- consulta que roda no cron, sobre um lead que ela cadastrou dias antes, e
-- carrega um fato de fora — "esta empresa publicou X" — com link para a fonte.
-- É a mesma natureza de `pagamento_confirmado`: acontece no mundo, não na tela.
--
-- E ele tem freio próprio, o que os recusados não tinham. `dominio/dor.ts` só
-- grava sinal de confiança `alta`, e `dominio/orcamento.ts` limita a
-- reconsulta a uma por lead a cada 30 dias. Um lead não pode gerar dois avisos
-- na mesma semana nem que o mundo inteiro fale dele.
--
-- Os dois que continuam de fora, e o motivo continua valendo: `whatsapp_caiu`
-- (a integração está em `FASE_DO_WHATSAPP = 'migrando'`, tipo sem chamador é
-- código morto com aparência de recurso) e `limite_do_plano` (a tela já devolve
-- a mensagem no mesmo segundo).
--
-- ## O que esta migration NÃO muda
--
-- As policies da 0066 seguem intactas: `select` por `is_workspace_member`,
-- `update` só de `lida_em` na própria linha, e **zero policy de insert para
-- `authenticated`**. Quem escreve continua sendo `service_role`, pelo mesmo
-- motivo de sempre — notificação forjável é aviso forjável, e um sinal de
-- mercado inventado na tela de outra empresa seria pior que os de cobrança,
-- porque vem com aparência de pesquisa.
--
-- ## A ordem, que importa
--
-- `adapters/notificacoes-sino.ts` carrega hoje um `@ts-expect-error` dizendo
-- que este tipo ainda não existe no banco. Aplicada esta migration e regerado o
-- tipo, aquele comentário passa a acusar erro sozinho — e é assim que ele
-- obriga a ser removido em vez de envelhecer em silêncio.

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check;

alter table public.notificacoes
  add constraint notificacoes_tipo_check check (
    tipo in (
      'pagamento_confirmado',
      'pagamento_atrasado',
      'plano_vencendo',
      'trial_terminando',
      -- Novo em 0073. Ver o cabeçalho para o porquê de ele passar no critério.
      'sinal_de_mercado'
    )
  );

comment on constraint notificacoes_tipo_check on public.notificacoes is
  'Lista fechada de propósito (0066): acrescentar um tipo exige migration, e '
  'exigir migration é o que transforma "entrou na lista" em decisão. '
  'sinal_de_mercado entrou em 0073.';

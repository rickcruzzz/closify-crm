-- O sino passa a aceitar um tipo que não é de operação.
--
-- ## O que muda, e por que precisa de migration
--
-- A 0066 fez o `check` de `notificacoes.tipo` restrito de propósito, e escreveu
-- o motivo: "acrescentar um tipo novo passa a exigir uma migration, que é uma
-- decisão, e não um `insert` casual em qualquer lugar do código".
--
-- Esta é a decisão. `convite_instagram` entra a pedido do dono.
--
-- ## A ressalva, registrada porque a decisão foi tomada contra ela
--
-- Os quatro tipos existentes são todos de DINHEIRO ou de PRAZO: pagamento
-- confirmado, pagamento atrasado, plano vencendo, trial terminando. A regra que
-- governa o sino, escrita em `components/layout/sino.tsx` em 02/09, é:
--
--     so entra o que ja provou valer um e-mail
--     nada do que a pessoa acabou de fazer
--
-- E ela nasceu de um caso medido: em 20/08, 8 dos 11 alertas da Central eram
-- ruído, e a conclusão foi que fila com lixo dentro ensina a ignorar a fila
-- inteira — junto com o item chato vai embora o alerta de dinheiro.
--
-- Convite para seguir um perfil é marketing, não operação. Foi levantado ao
-- dono antes de construir, com a alternativa (rodapé do produto, tela de
-- boas-vindas, rodapé dos e-mails) e com o dado de que o perfil tem 12.194
-- seguidores e 0,033% de engajamento. Ele reafirmou o pedido, e a decisão é
-- dele.
--
-- Fica escrito aqui porque o custo, se houver, aparece depois e em outro lugar:
-- numa notificação de pagamento que alguém dispensa sem ler.
--
-- ## Gravidade
--
-- `gravidadeDe()` devolve `media` para todo tipo que não esteja na lista de
-- `alta`, então este nasce com ponto CINZA sem precisar de mudança em código.
-- Correto: ponto vermelho só pode querer dizer "vai custar dinheiro".

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check;

alter table public.notificacoes
  add constraint notificacoes_tipo_check check (
    tipo in (
      'pagamento_confirmado',
      'pagamento_atrasado',
      'plano_vencendo',
      'trial_terminando',
      'convite_instagram'
    )
  );

-- O `href` continua exigindo caminho interno (`like '/%'`), e isso NÃO muda
-- aqui. O link do Instagram é externo, e a 0066 registrou que `href` apontando
-- para fora é vetor de phishing — quem escreve a notificação passaria a
-- controlar para onde o clique leva.
--
-- A saída é `/ir/instagram`, uma rota deste domínio que redireciona. O destino
-- fica no NOSSO código, versionado e revisável, em vez de numa linha do banco.

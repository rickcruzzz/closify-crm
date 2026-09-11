-- O sino passa a aceitar orientação de uso do produto.
--
-- ## Por que este tipo é diferente do `convite_instagram` da 0081
--
-- Os dois são "não-dinheiro", e param aí a semelhança.
--
--     convite_instagram   pede algo do usuario (siga um perfil). E marketing,
--                         e entrou contra a regra do sino
--     dica_de_uso         entrega algo ao usuario (existe um recurso que voce
--                         nao viu). E o produto orientando quem esta dentro
--
-- A regra escrita em `sino.tsx` é "só entra o que já provou valer um e-mail".
-- Esta passa no teste pelo motivo certo: a dica SAI por e-mail também, e o
-- e-mail é o formato longo da mesma coisa.
--
-- ## O caso que a motivou, medido
--
-- O primeiro usuário externo real do produto cadastrou 19 contatos à mão, um
-- por minuto, em 13 minutos. A importação de planilha existe desde 11/08 e ele
-- não usou — ou não sabe que existe, ou não achou. No ritmo dele, uma base de
-- 300 contatos custaria três horas e meia de digitação.
--
-- Ele completou o tour em 33 segundos, o que é normal: quase ninguém lê tour.
-- O checklist de ativação está visível na conta dele e mesmo assim o recurso
-- passou batido. Notificação é a terceira tentativa, e ela chega quando a
-- pessoa JÁ está trabalhando — que é quando a dica importa.
--
-- ## Gravidade
--
-- `media`, por omissão. Ponto vermelho só pode querer dizer "vai custar
-- dinheiro", e uma dica nunca custa.

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check;

alter table public.notificacoes
  add constraint notificacoes_tipo_check check (
    tipo in (
      'pagamento_confirmado',
      'pagamento_atrasado',
      'plano_vencendo',
      'trial_terminando',
      'convite_instagram',
      'dica_de_uso'
    )
  );

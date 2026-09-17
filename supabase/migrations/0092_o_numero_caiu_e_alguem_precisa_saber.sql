-- O WhatsApp caiu, e agora o produto avisa.
--
-- ## Este tipo foi RECUSADO em 02/09, e a recusa está escrita
--
-- `lib/notificacoes/tipos.ts` registra, palavra por palavra:
--
-- > `whatsapp_caiu` — a integracao esta em FASE_DO_WHATSAPP = 'migrando' e o
-- > e-mail que avisava disso nao existe mais. Tipo sem chamador e codigo morto
-- > com aparencia de recurso.
--
-- **A razão caducou em 17/09.** `FASE_DO_WHATSAPP` virou `'zapi'`, existe
-- conexão por empresa, existe webhook de desconexão, e ele grava o estado sem
-- avisar ninguém. O tipo deixa de ser código morto no mesmo commit em que ganha
-- chamador — que é exatamente a condição que a recusa original impunha.
--
-- ## Por que ele vale um lugar numa lista de seis
--
-- A regra de entrada do sino é dura, e existe por medição: em 20/08, 8 dos 11
-- alertas da Central eram ruído, e o efeito foi ninguém mais olhar a fila. Fila
-- com item sem valor ensina a ignorar a fila inteira, e junto com o item chato
-- vai embora o alerta de dinheiro.
--
-- Este passa por três motivos, e nenhum é "seria bom saber":
--
--     e o recurso PAGO parando    a empresa paga R$ 250 pelo WhatsApp no CRM.
--                                 Enquanto o numero esta fora, ela paga por uma
--                                 caixa de entrada que nao recebe
--     nao e algo que ela fez      a conexao nao oficial CAI sozinha: celular
--                                 sem bateria, aparelho trocado, WhatsApp Web
--                                 derrubado pela Meta. Ninguem apertou nada
--     o sintoma e SILENCIO        sem aviso, ela descobre pela ausencia — e
--                                 "ninguem me escreveu hoje" e exatamente o que
--                                 ela vai concluir
--
-- ## `alta`, e a gravidade aqui é sobre dinheiro como sempre foi
--
-- `gravidadeDe` reserva `alta` para "o que custa acesso ou receita se ninguém
-- agir", e o comentário avisa que pintar de vermelho o que não custa dissolve a
-- distinção.
--
-- Número fora do ar custa as duas coisas: o acesso ao recurso que foi pago, e a
-- venda que chega por mensagem enquanto ninguém vê. Num produto cuja promessa é
-- **não perder venda por esquecimento**, o canal de venda mudo é o pior estado
-- possível.
--
-- ## Uma coluna? Não. Só o `check` muda
--
-- A 0066 desenhou a tabela para isto: tipo novo é uma linha no `check`, e o
-- comentário dela diz que mexer na lista passa a exigir migration — é o que
-- transforma "entrou na lista" em decisão, nas duas direções. A 0073 e a 0075
-- já usaram esse caminho de ida e de volta.

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check;

alter table public.notificacoes
  add constraint notificacoes_tipo_check
  check (tipo in (
    'pagamento_confirmado',
    'pagamento_atrasado',
    'plano_vencendo',
    'trial_terminando',
    'convite_instagram',
    'dica_de_uso',
    'whatsapp_caiu'
  ));

comment on column public.notificacoes.tipo is
  'Lista FECHADA, espelhada em lib/notificacoes/tipos.ts. As duas precisam concordar: em 08/09 o TypeScript trazia sinal_de_mercado e o banco nao, o codigo compilava e dava 400 em producao.';

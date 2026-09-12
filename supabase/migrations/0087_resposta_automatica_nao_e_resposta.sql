-- Robô não é resposta, e tratá-lo como se fosse mentiria no painel.
--
-- ## O defeito, medido no PRIMEIRO disparo real
--
-- As 47 primeiras mensagens de 12/09 produziram 18 "respostas" — 38%, contra
-- os 3,8-7,2% que o setor responde. Número bom demais é o próprio sinal de
-- erro, e era: nenhuma das 18 era pessoa.
--
--     "Ola! Sou o Colibri, assistente virtual da Detecta"
--     "Ola me chamo Helena, sua assistente virtual"
--     "Agradecemos sua mensagem. Nao estamos disponiveis no momento"
--     "Estamos fora do horario. Seg-Sex: 9h-11h / 14h-17h"
--
-- O painel mostraria 38% de taxa de resposta, e a decisão que esse número
-- orienta é escalar para 200/dia sobre ruído. É a classe de erro que o
-- `estado-atual.md` registra em letras grandes: *"erro que produz número
-- plausível é o mais caro que existe"*.
--
-- ## O TEMPO é a prova, não o texto
--
--     em ate 60 segundos    25 de 27   (93%)
--     em ate 10 segundos    15
--     media                 15 segundos
--     depois de 5 minutos    0         <- NENHUMA
--
-- Dá para escrever um robô que não diz "assistente virtual" — e a Elevato
-- provou: um agente de IA respondeu em ~70s com *"Você está buscando uma
-- solução para organizar os retornos de orçamentos?"*, lendo a mensagem. O
-- texto não o pega; o tempo pega.
--
-- ## E a detecção GUARDA um achado de mercado
--
-- 38% das empresas dos cinco nichos têm automação de WhatsApp. Isso não é
-- ruído: `pontuarProspect` vale +3 para "já paga por software", e mais de um
-- terço da fila se qualifica nesse sinal sem que ninguém soubesse. Empresa que
-- paga por robô de atendimento é empresa que compra software.
--
-- Por isso a coluna se chama `automacao_detectada_em` e não `robo_ignorado`.

alter table public.prospeccao_interacao
  drop constraint if exists prospeccao_interacao_intencao_check;
alter table public.prospeccao_interacao
  add constraint prospeccao_interacao_intencao_check
  check (intencao in (
    'INTERESSE_ALTO', 'INTERESSE_MODERADO', 'PEDIU_PRECO', 'PEDIU_DETALHES',
    'QUER_DEMO', 'QUER_CONHECER', 'JA_USA_CRM', 'JA_TEM_PROCESSO',
    'SEM_INTERESSE', 'TALVEZ_DEPOIS', 'NAO_E_RESPONSAVEL', 'PEDIU_OUTRO_CONTATO',
    'OBJECAO_PRECO', 'OBJECAO_TEMPO', 'OBJECAO_NECESSIDADE', 'OBJECAO_CONFIANCA',
    'OBJECAO_JA_TENHO_SOLUCAO', 'OPT_OUT', 'SPAM', 'INCONCLUSIVO',
    'RESPOSTA_AUTOMATICA'
  ));

alter table public.prospeccao_prospect
  add column if not exists automacao_detectada_em timestamptz,
  add column if not exists respostas_automaticas int not null default 0;

comment on column public.prospeccao_prospect.automacao_detectada_em is
  'A empresa tem robo no WhatsApp. NAO e resposta: e o sinal "ja paga por software", que pontuarProspect vale +3. Medido em 12/09: 38% dos cinco nichos.';

-- Desfaz o que o webhook marcou errado nas primeiras 47.
with automaticas as (
  select p.id, count(*) as quantas, min(m.created_at) as primeira
    from public.prospeccao_prospect p
    join public.leads l on l.id = p.lead_id
    join public.conversas c on c.lead_id = l.id
    join public.mensagens m on m.conversa_id = c.id and m.direcao = 'recebida'
   where p.respondido_em is not null
     and extract(epoch from (m.created_at - p.enviado_em)) < 60
   group by p.id
)
update public.prospeccao_prospect p
   set respondido_em = null, estagio = 'CONTACTED',
       automacao_detectada_em = a.primeira, respostas_automaticas = a.quantas,
       intencao = null, temperatura = null, precisa_humano = false,
       mensagens_recebidas = 0, updated_at = now()
  from automaticas a
 where p.id = a.id;

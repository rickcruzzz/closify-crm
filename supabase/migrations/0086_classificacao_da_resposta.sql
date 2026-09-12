-- FASE 2: a resposta deixa de ser texto e vira dado comparável.
--
-- ## O que a Fase 1 deixou em aberto
--
-- Desde 12/09 a resposta do prospect entra no sistema (`conversas`/`mensagens`)
-- e o dono é avisado. O que não existe é **comparação**: duas respostas são dois
-- textos, e texto não soma. Sem categoria fechada não dá para perguntar qual
-- nicho responde melhor, qual objeção mata mais venda, ou se o score prevê
-- alguma coisa.
--
-- ## E por que estas colunas nascem AGORA e não nasceram na 0084
--
-- A 0084 deixou `intencao`, `objecao` e `temperatura` de fora de propósito, com
-- o motivo escrito: coluna gravada e nunca lida é a classe de defeito que este
-- projeto pagou três vezes seguidas — `utm_content` (0069), `gclid` (0071) e o
-- `utm_campaign` que casava por igualdade. As três produziram relatório com
-- aparência de medição e conteúdo vazio.
--
-- **Elas entram junto do leitor.** `/dono/inteligencia` nasce na mesma rodada e
-- é o consumidor de cada uma destas colunas. Nenhuma fica esperando alguém.
--
-- ## Dois lugares, e a diferença é a pergunta que cada um responde
--
--     prospeccao_interacao   o HISTORICO: uma linha por mensagem classificada,
--                            com o modelo, a versao do prompt e a confianca.
--                            Responde "como chegamos aqui" e permite auditar a
--                            IA depois — inclusive descobrir que ela errava
--     prospeccao_prospect    o ESTADO DE AGORA: a ultima intencao, a ultima
--                            objecao, a temperatura. Responde "o que fazer com
--                            esta pessoa hoje"
--
-- Guardar só o estado apagaria a trilha; guardar só o histórico obrigaria a
-- reconstruir o estado por agregação em toda leitura da fila.
--
-- ## As categorias são FECHADAS, e é isso que as torna úteis
--
-- Um modelo de linguagem solto inventa vinte nomes para a mesma objeção, e vinte
-- nomes não somam. O `check` no banco é a última porta: se o classificador
-- devolver algo fora da lista, a linha é recusada em vez de entrar e
-- contaminar a estatística com uma categoria de um caso só.
--
-- ## O estágio tem NOVE valores, não doze
--
-- `CHECKOUT_SENT`, `PAYMENT_PENDING` e `CONVERTED` ficam de fora porque nada os
-- escreve: ninguém envia checkout pela conversa ainda. Um `check` que os
-- aceitasse afirmaria um caminho que nenhuma linha de código percorre — e a
-- primeira leitura do painel concluiria que ninguém chega lá, quando a verdade
-- é que não há como chegar.

-- ---------------------------------------------------------------------------
-- 1. O histórico: uma linha por mensagem classificada
-- ---------------------------------------------------------------------------

create table if not exists public.prospeccao_interacao (
  id uuid primary key default gen_random_uuid(),

  -- Anulável: a resposta pode vir de um número que não está na fila. A
  -- classificação vale do mesmo jeito, e perder a análise porque falta a
  -- atribuição seria trocar o dado importante pelo acessório.
  prospect_id uuid references public.prospeccao_prospect(id) on delete set null,
  conversa_id uuid references public.conversas(id) on delete cascade,

  -- A mensagem que foi lida. UNIQUE: é a idempotência — rodar o
  -- classificador duas vezes sobre a mesma fila não gera duas análises, e não
  -- conta a mesma resposta duas vezes na estatística.
  mensagem_id uuid not null unique references public.mensagens(id) on delete cascade,

  intencao text not null check (intencao in (
    'INTERESSE_ALTO', 'INTERESSE_MODERADO', 'PEDIU_PRECO', 'PEDIU_DETALHES',
    'QUER_DEMO', 'QUER_CONHECER', 'JA_USA_CRM', 'JA_TEM_PROCESSO',
    'SEM_INTERESSE', 'TALVEZ_DEPOIS', 'NAO_E_RESPONSAVEL', 'PEDIU_OUTRO_CONTATO',
    'OBJECAO_PRECO', 'OBJECAO_TEMPO', 'OBJECAO_NECESSIDADE', 'OBJECAO_CONFIANCA',
    'OBJECAO_JA_TENHO_SOLUCAO', 'OPT_OUT', 'SPAM', 'INCONCLUSIVO'
  )),

  -- Anulável: nem toda resposta traz objeção. "Quanto custa?" é interesse puro,
  -- e forçar uma objeção ali inventaria a barreira mais comum do painel.
  objecao text check (objecao is null or objecao in (
    'PRECO', 'TEMPO', 'PRIORIDADE', 'JA_USA_CRM', 'JA_USA_PLANILHA',
    'NAO_VE_NECESSIDADE', 'DESCONFIANCA', 'NAO_E_RESPONSAVEL', 'SEM_MOMENTO',
    'QUER_COMPARAR', 'CONCORRENTE', 'OUTRA'
  )),
  -- O trecho literal que sustenta a objeção. Sem ele, "12 disseram preço" não
  -- é auditável — e a primeira suspeita de que o classificador erra não teria
  -- como ser confirmada nem descartada.
  objecao_texto text,

  temperatura text not null check (temperatura in (
    'frio', 'morno', 'quente', 'muito_quente', 'fechamento'
  )),

  estagio_antes text,
  estagio_depois text,

  -- 0 a 1. Abaixo do piso o classificador NÃO decide sozinho: a linha entra
  -- com `precisa_humano`, que é o que impede uma estatística construída sobre
  -- chutes.
  confianca numeric(4, 3) check (confianca is null or (confianca >= 0 and confianca <= 1)),

  precisa_humano boolean not null default false,
  -- Por que precisa. Texto curto e operacional.
  motivo_humano text,

  -- Uma frase sobre a DECISÃO, nunca o raciocínio interno do modelo.
  resumo text,

  -- Sem os dois, uma queda de qualidade depois de trocar de modelo ou de
  -- prompt fica indistinguível de "os prospects pioraram".
  modelo text,
  versao_do_prompt text,

  created_at timestamptz not null default now()
);

create index if not exists prospeccao_interacao_prospect_idx
  on public.prospeccao_interacao (prospect_id, created_at desc);

-- O painel agrupa por objeção. Parcial porque a maioria das respostas não tem.
create index if not exists prospeccao_interacao_objecao_idx
  on public.prospeccao_interacao (objecao)
  where objecao is not null;

alter table public.prospeccao_interacao enable row level security;

comment on table public.prospeccao_interacao is
  'Uma linha por mensagem classificada: intencao, objecao, temperatura, confianca, modelo e versao do prompt. Idempotente por mensagem_id. RLS ligada e zero policy — so service_role.';

-- ---------------------------------------------------------------------------
-- 2. O estado de agora, no prospect
-- ---------------------------------------------------------------------------

alter table public.prospeccao_prospect
  add column if not exists intencao text,
  add column if not exists objecao text,
  add column if not exists temperatura text,
  -- Quantas mensagens ele já mandou. É o que separa "respondeu e sumiu" de
  -- "está conversando", e as duas pedem coisas opostas.
  add column if not exists mensagens_recebidas int not null default 0,
  add column if not exists precisa_humano boolean not null default false,
  add column if not exists classificado_em timestamptz;

-- O estágio ganha os valores que a Fase 2 de fato escreve — e SÓ eles.
alter table public.prospeccao_prospect
  drop constraint if exists prospeccao_prospect_estagio_check;
alter table public.prospeccao_prospect
  add constraint prospeccao_prospect_estagio_check
  check (estagio in (
    'CONTACTED', 'REPLIED', 'QUALIFYING', 'INTERESTED',
    'OBJECTION', 'CONSIDERING', 'LOST', 'OPTED_OUT', 'HUMAN_HANDOFF'
  ));

-- "Quem precisa de mim agora" é a única fila acionável que esta tabela produz
-- hoje. Parcial: a esmagadora maioria nunca respondeu.
create index if not exists prospeccao_prospect_humano_idx
  on public.prospeccao_prospect (precisa_humano, respondido_em desc)
  where precisa_humano = true;

comment on column public.prospeccao_prospect.intencao is
  'A ULTIMA intencao classificada. O historico inteiro esta em prospeccao_interacao.';
comment on column public.prospeccao_prospect.precisa_humano is
  'A IA se recusou a decidir: confianca baixa, assunto juridico, irritacao, pedido fora de politica. E fila de trabalho, nao erro.';

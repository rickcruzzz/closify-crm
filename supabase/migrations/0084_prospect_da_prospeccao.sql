-- O prospect passa a existir no banco, e não só num JSON na máquina do dono.
--
-- ## Por que isto é tabela, quando a decisão do projeto é o contrário
--
-- `lib/dono/silenciados.ts` deixou escrito que *"criar tabela e migration para
-- guardar uma decisão pessoal acopla essa decisão ao schema que os clientes
-- usam"*, e a prospecção seguiu essa regra desde 08/09: o universo mora em CSV
-- versionado e o progresso em `.dono-prospeccao.json`.
--
-- A regra continua certa **para o progresso de uma rodada**, e este caso é o
-- contrário dela pelo mesmo motivo que a 0080 foi: quem escreve aqui é um
-- estranho, em produção. A resposta do prospect chega pelo webhook da
-- Evolution, que roda na Vercel — e a Vercel não tem disco. Não existe versão
-- em arquivo disto.
--
-- `.dono-prospeccao.json` **continua existindo e continua sendo a verdade do
-- que já saiu**. Esta tabela não o substitui: ela guarda o que só pode ser
-- sabido do lado de lá, que é o que aconteceu DEPOIS do envio.
--
-- ## Só colunas com leitor, e a ausência é a decisão
--
-- O desenho pedido previa `intencao`, `objecao`, `temperatura` e um estágio de
-- doze valores. Nada disso entra agora, porque nada disso tem escritor nem
-- leitor nesta fase — e coluna gravada e nunca lida é a classe de defeito que
-- este projeto já pagou três vezes seguidas:
--
--     utm_content   0069, criada em 03/09, capturada, gravada, ZERO leitores
--     gclid         0071, criada em 04/09, mesma historia, 0 de 44 workspaces
--     utm_campaign  casava por igualdade com o nome da campanha, e nunca casou
--
-- As três produziram relatório com aparência de medição e conteúdo vazio. As
-- colunas de classificação nascem junto do consumidor delas, na fase em que a
-- IA de fato ler a resposta — e não antes.
--
-- Pelo mesmo critério, `estagio` tem três valores e não doze: `CONTACTED`,
-- `REPLIED` e `OPTED_OUT` são os únicos com escritor hoje. Um `check` com
-- `CHECKOUT_SENT` dentro afirmaria um caminho que nenhuma linha de código
-- percorre.
--
-- ## O que NÃO precisa de coluna, e por quê
--
-- `montarAbordagem` escolhe o gancho por sorteio semeado no DOMÍNIO — é
-- determinístico. Guardar "qual gancho foi usado" seria guardar algo
-- recalculável a partir de uma coluna que já existe.
--
-- O que **não** é recalculável é o TEXTO: no dia em que `abordagem.ts` mudar
-- uma palavra, a mensagem que saiu deixa de poder ser reconstruída. Por isso
-- `mensagem_enviada` é coluna e o gancho não é. A pergunta "qual gancho
-- converte" continua respondível, derivando do domínio no momento da leitura.
--
-- ## RLS ligada, zero policy
--
-- Mesmo padrão de `error_logs`, `asaas_webhook_events` e
-- `descadastro_de_prospeccao`. Isto é dado de prospecção do dono — nome,
-- telefone e pontuação de centenas de empresas que nunca ouviram falar do
-- produto. Nenhum usuário autenticado do produto tem o que fazer aqui, e a
-- chave pública está no HTML por design.

create table if not exists public.prospeccao_prospect (
  id uuid primary key default gen_random_uuid(),

  -- A chave de tudo, como em toda a prospecção: um domínio, uma linha. É ela
  -- que liga esta tabela ao CSV do universo e ao `.dono-prospeccao.json`.
  dominio text not null unique,

  -- Últimos 8 dígitos, mesma convenção de `encontrar_lead_por_telefone` (0047)
  -- e da 0083. É por aqui que o webhook acha o prospect: o WhatsApp entrega o
  -- remetente com DDI, e o CSV guardou o número em qualquer formato.
  telefone_ultimos8 text,

  nome text,
  vertical text,
  pontos int,

  -- O texto EXATO que saiu. Ver o cabeçalho: é o único dado desta tabela que
  -- não é recalculável depois que o gerador mudar.
  mensagem_enviada text,
  enviado_em timestamptz,
  respondido_em timestamptz,

  -- Só os três que têm escritor. O resto entra com o código que os escreve.
  estagio text not null default 'CONTACTED'
    check (estagio in ('CONTACTED', 'REPLIED', 'OPTED_OUT')),

  -- O elo prospect -> cliente, que hoje não existe em lugar nenhum: a
  -- auditoria mediu que o único cliente externo real chegou com as OITO
  -- colunas de UTM nulas. Anuláveis porque a esmagadora maioria dos prospects
  -- nunca vira nem contato.
  lead_id uuid references public.leads(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O webhook resolve o prospect por telefone a cada mensagem recebida. Sem
-- índice isso é varredura sequencial na chegada de cada resposta.
create index if not exists prospeccao_prospect_telefone_idx
  on public.prospeccao_prospect (telefone_ultimos8)
  where telefone_ultimos8 is not null;

-- "Quem respondeu e ainda não foi atendido" é a única pergunta de fila que
-- esta tabela responde hoje. Parcial em quem respondeu: prospect que só foi
-- contatado é a esmagadora maioria e não pertence a este índice.
create index if not exists prospeccao_prospect_respondidos_idx
  on public.prospeccao_prospect (respondido_em desc)
  where respondido_em is not null;

alter table public.prospeccao_prospect enable row level security;

comment on table public.prospeccao_prospect is
  'Prospect abordado e o que aconteceu depois. Escrita por service_role (rota local do disparo e webhook da Evolution). RLS ligada e sem policy de proposito: e dado de prospeccao do dono, nao do produto.';

comment on column public.prospeccao_prospect.mensagem_enviada is
  'O texto exato que saiu. Coluna porque NAO e recalculavel depois que abordagem.ts mudar — ao contrario do gancho, que e deterministico pelo dominio.';

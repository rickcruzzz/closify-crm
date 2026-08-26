-- A conversa de WhatsApp passa a existir como coisa, não só como atividade.
--
-- ## O buraco
--
-- Hoje a mensagem recebida vira `activities` com `type = 'whatsapp'` e uma
-- tarefa "Responder no WhatsApp". Funciona para LEMBRAR, e não serve para
-- CONVERSAR: `activities` não tem direção (recebida ou enviada), não tem id da
-- mensagem no WhatsApp, não sabe se alguém já respondeu, e não tem como
-- guardar áudio.
--
-- Sem isso o produto avisa "fulano te mandou mensagem" e manda a pessoa
-- responder pelo celular. É o motivo nº 1 de abandono de CRM na PME
-- brasileira, com prazo medido de UMA SEMANA.
--
-- ## O que decide o desenho: o relógio, não a caixa de entrada
--
--     97%  dos adultos brasileiros abrem o WhatsApp todo dia
--      5   minutos é o tempo que o cliente considera ideal
--     40%  desistem da compra se não responderem em 10 minutos
--
-- Todo concorrente ordena por mensagem mais recente, que é a ordem certa para
-- CONVERSAR. A ordem certa para NÃO PERDER VENDA é quem espera há mais tempo,
-- e é por isso que `respondida_em` é coluna e não cálculo.
--
-- `activities` continua recebendo a mensagem: a linha do tempo do contato não
-- muda, e `/hoje` continua cobrando a resposta. Esta migration acrescenta,
-- não substitui.

-- ===========================================================================
-- conversas
-- ===========================================================================

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,

  -- Só `whatsapp` hoje. Existe como coluna para o dia em que o Instagram
  -- Direct entrar (2º canal de venda da PME brasileira, 57% pelo Sebrae) sem
  -- precisar de migration de tabela — ele depende do mesmo portão da Meta que
  -- o WhatsApp oficial, então virá junto.
  canal text not null default 'whatsapp',

  -- Quando chegou a última mensagem DELES. É o que alimenta o relógio.
  ultimo_recebido_em timestamptz,
  -- Quando saiu a última NOSSA.
  ultimo_enviado_em timestamptz,

  -- `null` significa ESPERANDO RESPOSTA. É o coração da ordenação.
  --
  -- Coluna e não subconsulta em `mensagens`: a lista é lida a cada
  -- carregamento da tela mais aberta do produto, e derivar isso por agregação
  -- a cada render pagaria caro exatamente onde não pode.
  respondida_em timestamptz,

  -- Quem assumiu a conversa. Confere contra `workspace_members` na Server
  -- Action, mesmo padrão de `conferirAlvo` para `assignee_id` em tarefas.
  dono_id uuid references auth.users(id) on delete set null,
  -- Quando assumiu. Expira em minutos e é o que sustenta o aviso de colisão
  -- ("Fulano está respondendo") sem precisar de presença em tempo real.
  assumida_em timestamptz,

  arquivada_em timestamptz,

  created_at timestamptz not null default now(),

  -- Uma conversa por contato por canal. É o que faz o webhook poder usar
  -- `upsert` sem precisar ler antes.
  unique (workspace_id, lead_id, canal)
);

-- O índice que a tela usa, na ordem exata em que ela filtra e ordena:
-- da empresa, não arquivada, esperando primeiro, mais antiga no topo.
--
-- Parcial em `arquivada_em is null` porque a tela nunca lista arquivada — um
-- índice que não carrega linha inútil é menor e mais rápido de varrer.
create index if not exists conversas_espera_idx
  on public.conversas (workspace_id, respondida_em nulls first, ultimo_recebido_em)
  where arquivada_em is null;

-- Busca por lead: usada pelo webhook a cada mensagem e pelo painel do contato.
create index if not exists conversas_lead_idx
  on public.conversas (workspace_id, lead_id);

alter table public.conversas enable row level security;

-- Membro lê e escreve; o isolamento é por empresa como em todo o resto.
-- `(select ...)` dentro do parêntese: o Postgres avalia uma vez e reusa, em
-- vez de chamar a função linha a linha. Mesmo padrão de `activities`.
drop policy if exists conversas_select on public.conversas;
create policy conversas_select on public.conversas
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy if exists conversas_insert on public.conversas;
create policy conversas_insert on public.conversas
  for insert with check ((select public.is_workspace_member(workspace_id)));

-- `using` E `with check` nos dois: sem o segundo, um membro poderia ATUALIZAR
-- uma conversa mudando o `workspace_id` para outra empresa. O `using` avalia a
-- linha ANTES da mudança e aprovaria. Armadilha já paga na 0031.
drop policy if exists conversas_update on public.conversas;
create policy conversas_update on public.conversas
  for update
  using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

comment on table public.conversas is
  'Uma conversa por contato por canal. respondida_em nulo = esperando resposta, e e o que ordena a tela de Conversas.';

-- ===========================================================================
-- mensagens
-- ===========================================================================

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversa_id uuid not null references public.conversas(id) on delete cascade,

  direcao text not null check (direcao in ('recebida', 'enviada')),

  -- O Brasil envia 4x mais áudio que qualquer outro país, e 8 em cada 10
  -- brasileiros mandam áudio. Uma caixa de entrada que só entende texto está
  -- quebrada para a maioria das conversas do público-alvo.
  tipo text not null default 'texto'
    check (tipo in ('texto', 'audio', 'imagem', 'video', 'documento', 'figurinha', 'outro')),

  texto text not null default '',

  -- Mídia não é baixada no webhook: `maxDuration` é 15s e o laço já gasta
  -- ~330ms por mensagem. Guardamos a chave e buscamos sob demanda.
  midia_chave text,
  midia_mime text,
  midia_segundos int,

  -- Id da mensagem no WhatsApp. Único por empresa: é o que impede a mesma
  -- mensagem de entrar duas vezes se o Evolution reenviar o evento.
  --
  -- Anulável porque mensagem ENVIADA nasce antes de o WhatsApp devolver o id,
  -- e o índice único é parcial por isso.
  external_id text,

  enviada_por uuid references auth.users(id) on delete set null,

  status text not null default 'enviada'
    check (status in ('pendente', 'enviada', 'falhou')),
  -- Por que falhou, para a tela poder dizer em vez de só mostrar um X.
  erro text,

  created_at timestamptz not null default now()
);

-- A tela lê "as mensagens desta conversa, em ordem". Índice na ordem exata.
create index if not exists mensagens_conversa_idx
  on public.mensagens (conversa_id, created_at);

-- Dedupe de mensagem recebida. Parcial: `external_id` é nulo em mensagem
-- nossa recém-criada, e `null` não colide com `null` em unique — mas o índice
-- parcial deixa a intenção explícita e não carrega linha à toa.
create unique index if not exists mensagens_external_id_unico
  on public.mensagens (workspace_id, external_id)
  where external_id is not null;

alter table public.mensagens enable row level security;

drop policy if exists mensagens_select on public.mensagens;
create policy mensagens_select on public.mensagens
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy if exists mensagens_insert on public.mensagens;
create policy mensagens_insert on public.mensagens
  for insert with check ((select public.is_workspace_member(workspace_id)));

-- Update existe só para o envio marcar `enviada`/`falhou` depois da resposta
-- do Evolution. Não há delete: apagar mensagem de conversa é reescrever
-- história com o cliente, e o caminho certo é arquivar a conversa.
drop policy if exists mensagens_update on public.mensagens;
create policy mensagens_update on public.mensagens
  for update
  using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

comment on table public.mensagens is
  'Mensagens de uma conversa, recebidas e enviadas. external_id unico por empresa e o dedupe do reenvio do Evolution.';

-- ===========================================================================
-- O teto de mensagens, defesa contra abuso
-- ===========================================================================
--
-- Mesma razão do teto de tarefas da 0029: sem limite nenhum, uma empresa Free
-- com script poderia encher a tabela. O número é folgado de propósito — não é
-- regra de negócio, é anteparo.
--
-- SEM `for update`, e a escolha é deliberada: a 0026 precisou de lock porque
-- 50 contatos é fronteira de monetização e o 51º é receita perdida. Aqui o
-- estouro sob corrida é do tamanho da concorrência e para na leva seguinte. O
-- lock cairia na MESMA linha de workspace que a trava de contatos pega, e
-- faria toda mensagem esperar uma importação de planilha terminar.

create or replace function public.checar_teto_de_mensagens()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  teto constant int := 200000;
  total int;
begin
  select count(*) into total
    from public.mensagens m
   where m.workspace_id = new.workspace_id;

  if total >= teto then
    raise exception 'Limite de % mensagens atingido nesta empresa.', teto
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists mensagens_teto on public.mensagens;
create trigger mensagens_teto
  before insert on public.mensagens
  for each row execute function public.checar_teto_de_mensagens();

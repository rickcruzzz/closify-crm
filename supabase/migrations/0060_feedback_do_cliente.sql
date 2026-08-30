-- O cliente não tinha como falar com o produto de dentro do produto.
--
-- Medido em 30/08, no commit `1c338bd`: 10 itens na barra lateral e nenhum de
-- suporte; 17 tabelas e nenhuma de relato. O único canal permanente vive no
-- rodapé da LANDING (`components/landing/public-footer.tsx`) — quem já é
-- cliente, logado, precisa SAIR do produto para achar o e-mail.
--
-- Não é esquecimento. `docs/estado-atual.md` registra o botão de "reportar
-- problema" como cortado de propósito em 18/08, junto com o print automático
-- de tela; o motivo do corte era o print (captura dado de terceiro sem RLS
-- pronta), e o botão foi junto. A entrada termina com "fica registrado como
-- próximo passo se a base provar valor".
--
-- O que mudou: o tráfego pago está prestes a rodar, e `docs/dor-de-mercado.md`
-- registra que a dor selecionada tem boa evidência externa e NENHUMA
-- confirmação de quem usou este produto. O canal é o instrumento que produz
-- esse dado — e criado depois dos primeiros clientes, não recupera o que eles
-- teriam dito.

-- ---------------------------------------------------------------------------
-- Tabela de sistema, exatamente o padrão de `error_logs` (0046)
-- ---------------------------------------------------------------------------
--
-- RLS ligada e ZERO policy: só `service_role`, via `createAdminClient()` a
-- partir da Server Action, grava e lê. Este projeto não tem conceito de "dono
-- da plataforma" no RLS — toda a superfície gira em `is_workspace_member` /
-- `is_workspace_admin`, relativo a um workspace —, e inventar um papel novo
-- para uma tabela criaria uma segunda doutrina de autorização convivendo com
-- a primeira. A leitura é a Central do Dono, que já roda fora da RLS e só em
-- localhost.
--
-- A consequência a dizer na cara: o cliente NÃO consegue reler o que enviou.
-- É deliberado — devolver a lista exigiria policy por workspace, e o valor de
-- reler o próprio texto é baixo perto de manter esta tabela com a mesma
-- doutrina das outras duas de sistema.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),

  -- Os dois tipos têm urgências OPOSTAS, e é por isso que são coluna e não
  -- texto livre: só 'problema' dispara e-mail. Sugestão espera dias sem custo;
  -- problema é cliente travado, pagando, e o dono sem saber.
  --
  -- `check` e não enum do Postgres: a lição da fila técnica é que
  -- `deal_stage` virou enum e hoje impede pipelines customizáveis, porque
  -- `alter type ... drop value` não existe. Um terceiro tipo aqui é uma linha
  -- de `check`, não uma migration de recriação de tipo.
  tipo text not null check (tipo in ('problema', 'sugestao')),

  -- 4000 é folgado para relato humano e ainda impede que um POST automatizado
  -- encha a tabela com um texto só. O schema do lado do TypeScript trava o
  -- mesmo número — regra que só vive na Server Action não é regra, e esta
  -- fica nos dois lados de propósito.
  mensagem text not null check (char_length(mensagem) between 1 and 4000),

  -- ## O contexto, que é o que dá valor ao registro
  --
  -- Quem escreve "não funciona" não diz a tela, o plano nem o navegador — e
  -- são os três que separam resolver de adivinhar. Todos preenchidos NO
  -- SERVIDOR, nunca pelo cliente: valor vindo do navegador é informação, não
  -- prova, e isso já foi pago em 20/08, quando um arquivo de 720×720 declarado
  -- como 1080×1080 passou pela validação e entrou na biblioteca.
  rota text,
  plano text,
  user_agent text,

  -- Sem FK, como em `error_logs`: apagar a empresa não pode apagar a evidência
  -- do problema que ela relatou — e um `on delete cascade` faria exatamente
  -- isso, justo no caso em que a pessoa cancelou POR CAUSA do problema.
  workspace_id uuid,
  user_id uuid,

  -- Mesmo motivo da 0058 em `error_logs`: relato do dono e das contas de teste
  -- é útil e não pode se misturar com o de cliente. Uma fila com 92% de ruído
  -- ensina a ignorar a fila inteira — foi o que a Central pagou em 20/08, com
  -- 8 de 11 alertas falsos.
  --
  -- Preenchido por `ehContaDeTeste` (`lib/dono/contas-internas.ts`), a função
  -- OFICIAL. Escrever um filtro novo aqui seria repetir o erro de 29/08, que
  -- classificou 23 empresas como externas quando eram 6 e contaminou quatro
  -- documentos com um número plausível.
  interno boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Índice parcial: a Central lê a fila de CLIENTE, e é essa leitura que precisa
-- ser rápida. Erro interno é histórico curto (purga de 14 dias abaixo) e não
-- justifica entrada própria no índice.
create index feedback_cliente_recente_idx
  on public.feedback (created_at desc)
  where interno = false;

comment on table public.feedback is
  'Relato de problema e sugestão enviados pelo cliente de dentro do produto. Tabela de sistema: RLS ligada, zero policy, lida só pela Central do Dono.';

-- ---------------------------------------------------------------------------
-- Purga, na mesma migration — e isso é decisão, não zelo
-- ---------------------------------------------------------------------------
--
-- `error_logs` foi a última tabela de sistema deste banco a ganhar purga, e
-- ganhou só na 0059, catorze migrations depois de nascer. Nesse intervalo ela
-- cresceu sem teto. A 0047 já tinha aprendido isso pela conta explícita:
-- projetada a 400 clientes, a tabela de dedupe chegaria a 9,7 GB em 12 meses.
--
-- Criar tabela nova de texto SEM purga, sabendo disso, seria repetir de olhos
-- abertos. As janelas seguem as mesmas da 0059, pelos mesmos motivos.
--
-- **Um ano para relato de cliente**, e não 90 dias como o erro técnico: erro
-- de três meses atrás não responde mais nada, mas "cinco pessoas pediram
-- exportação em CSV" continua sendo a razão de construir a funcionalidade um
-- ano depois. É a única tabela deste banco em que o valor do registro CRESCE
-- com a repetição.
--
-- **14 dias para o interno**, igual à 0059: teste do dono serve para uma
-- investigação em curso, não para histórico.

create or replace function public.purge_old_feedback()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cliente integer;
  v_interno integer;
begin
  delete from public.feedback
   where interno = false
     and created_at < now() - interval '365 days';
  get diagnostics v_cliente = row_count;

  delete from public.feedback
   where interno = true
     and created_at < now() - interval '14 days';
  get diagnostics v_interno = row_count;

  return v_cliente + v_interno;
end;
$$;

-- `security definer` para atravessar a RLS (tabela com RLS ligada e zero
-- policy), e `execute` revogado de todo mundo. Único chamador:
-- `/api/cron/limpar-eventos` via `createAdminClient()`.
--
-- `revoke all ... from public`, não revoke de coluna: a 0013 já pagou a lição
-- de que revogar parte não subtrai de um grant mais amplo já concedido.
revoke all on function public.purge_old_feedback() from public;

comment on function public.purge_old_feedback() is
  'Apaga relato de cliente com mais de 1 ano e relato interno com mais de 14 dias. Chamada pelo cron diário, nunca por usuário.';

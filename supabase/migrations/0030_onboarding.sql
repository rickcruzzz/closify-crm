-- Velo Funil, onboarding: estado por pessoa, dados da empresa, criação idempotente
--
-- Quem cria conta hoje atravessa uma tela ("Nome da empresa") e cai no
-- dashboard sem contexto. Esta migration é a base do onboarding: onde a pessoa
-- parou, o que ela respondeu, e os campos da empresa que a tela de
-- Configurações passa a editar.

-- ============================================================================
-- 1. Estado do onboarding, da PESSOA, não da empresa
-- ============================================================================
--
-- Tabela própria em vez de colunas em `workspaces` porque o dono do dado é
-- outro. Quem é convidado para uma empresa que já existe tem o próprio
-- onboarding a fazer, e quem cria uma segunda empresa não recomeça do zero.
-- Guardar isso no workspace misturaria as duas coisas.

create table public.onboarding_state (
  user_id uuid primary key references auth.users (id) on delete cascade,

  status text not null default 'not_started'
    constraint onboarding_status_valido
      check (status in ('not_started', 'in_progress', 'skipped', 'completed')),

  -- Onde parou. Nulo para quem não começou ou já terminou, é o que permite
  -- voltar exatamente ao passo certo depois de fechar o navegador.
  etapa text
    constraint onboarding_etapa_valida
      check (etapa is null or etapa in ('empresa', 'segmento', 'venda', 'equipe', 'processando')),

  tour_status text not null default 'not_started'
    constraint onboarding_tour_valido
      check (tour_status in ('not_started', 'skipped', 'completed')),

  checklist_oculto boolean not null default false,

  -- `jsonb` e não uma coluna por pergunta: o pedido é que novas perguntas
  -- entrem sem mexer na arquitetura, e coluna por pergunta obrigaria uma
  -- migration a cada uma. O teto de tamanho existe porque isto é escrito pelo
  -- PostgREST com a chave pública, sem ele, dá para encher o banco com um
  -- único update.
  respostas jsonb not null default '{}'::jsonb
    constraint onboarding_respostas_no_teto
      check (pg_column_size(respostas) <= 8192),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. RLS de DONO, a primeira do projeto que não é por workspace
-- ============================================================================
--
-- Todas as outras tabelas usam `is_workspace_member`. Aqui a linha pertence à
-- pessoa: nem o admin da empresa dela pode ler o onboarding de um colaborador.

alter table public.onboarding_state enable row level security;

create policy "onboarding_state_select" on public.onboarding_state
  for select using (user_id = (select auth.uid()));

create policy "onboarding_state_insert" on public.onboarding_state
  for insert with check (user_id = (select auth.uid()));

create policy "onboarding_state_update" on public.onboarding_state
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sem policy de DELETE: apagar o estado faria o onboarding voltar do começo
-- para quem já concluiu. A linha morre junto da conta, pelo `on delete
-- cascade`.

-- `updated_at` por trigger e não pelo app: é o único jeito de o valor não
-- depender de quem escreve lembrar de mandá-lo.
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger onboarding_state_updated_at
  before update on public.onboarding_state
  for each row
  execute function public.tocar_updated_at();

-- ============================================================================
-- 3. Dados da empresa
-- ============================================================================
--
-- Todas anuláveis: as 9 empresas que já existem continuam válidas sem tocar em
-- nenhuma linha. Só o nome é obrigatório, e ele já era.
--
-- Os tetos de tamanho não são capricho de schema. `workspaces` é escrita pelo
-- PostgREST com a chave pública, e a política `workspaces_update` autoriza o
-- admin a gravar, sem teto, um admin (ou quem pegasse a sessão dele) enche o
-- banco com um campo de texto.

alter table public.workspaces
  add column if not exists segmento text
    constraint workspaces_segmento_no_teto check (segmento is null or length(segmento) <= 40),
  add column if not exists modelo_venda text
    constraint workspaces_modelo_venda_valido
      check (modelo_venda is null or modelo_venda in ('servicos', 'produtos', 'ambos')),
  add column if not exists tamanho_equipe text
    constraint workspaces_tamanho_equipe_valido
      check (tamanho_equipe is null or tamanho_equipe in ('so_eu', '2_5', '6_20', '21_mais')),

  add column if not exists logo_url text
    constraint workspaces_logo_no_teto check (logo_url is null or length(logo_url) <= 500),
  add column if not exists nome_fantasia text
    constraint workspaces_fantasia_no_teto check (nome_fantasia is null or length(nome_fantasia) <= 120),

  -- Só dígitos, e opcional de propósito: MEI e autônomo não têm CNPJ, e exigir
  -- aqui deixaria de fora justamente o público-alvo do plano Free.
  add column if not exists cnpj text
    constraint workspaces_cnpj_formato check (cnpj is null or cnpj ~ '^[0-9]{14}$'),

  add column if not exists descricao text
    constraint workspaces_descricao_no_teto check (descricao is null or length(descricao) <= 500),

  add column if not exists email_comercial text
    constraint workspaces_email_no_teto check (email_comercial is null or length(email_comercial) <= 160),
  add column if not exists whatsapp text
    constraint workspaces_whatsapp_formato check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  add column if not exists telefone text
    constraint workspaces_telefone_formato check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  add column if not exists site text
    constraint workspaces_site_no_teto check (site is null or length(site) <= 200),

  add column if not exists cep text
    constraint workspaces_cep_formato check (cep is null or cep ~ '^[0-9]{8}$'),
  add column if not exists endereco text
    constraint workspaces_endereco_no_teto check (endereco is null or length(endereco) <= 160),
  add column if not exists numero text
    constraint workspaces_numero_no_teto check (numero is null or length(numero) <= 20),
  add column if not exists complemento text
    constraint workspaces_complemento_no_teto check (complemento is null or length(complemento) <= 80),
  add column if not exists bairro text
    constraint workspaces_bairro_no_teto check (bairro is null or length(bairro) <= 80),
  add column if not exists cidade text
    constraint workspaces_cidade_no_teto check (cidade is null or length(cidade) <= 80),
  add column if not exists estado text
    constraint workspaces_estado_formato check (estado is null or estado ~ '^[A-Z]{2}$');

-- A trigger `proteger_colunas_do_workspace` (0027) NÃO precisa mudar: ela
-- guarda `plan`, `id`, `created_by` e `created_at`, e nenhuma coluna acima
-- entra nessa lista. As novas ficam sob `workspaces_update`, que já exige
-- `is_workspace_admin(id)`, ou seja, membro comum não edita dados da empresa,
-- e isso passa a valer sem uma linha a mais.

-- ============================================================================
-- 4. Criação idempotente
-- ============================================================================
--
-- `create_workspace_with_admin` não é idempotente: chamada duas vezes cria
-- duas empresas. Hoje a segunda esbarra no limite de 1 empresa do Free (0018)
-- e morre com erro; num workspace Pro, criaria a segunda em silêncio.
--
-- O onboarding tem exatamente os gatilhos que provocam a chamada dupla:
-- atualizar a página no meio, clicar duas vezes no botão, voltar do e-mail de
-- confirmação. Daí esta função.
--
-- `security invoker` de propósito, ao contrário da 0007. A criação continua
-- delegada à RPC definer que já existe, é ela que precisa do privilégio para
-- inserir em `workspace_members`. O UPDATE aqui passa pela RLS normal, então
-- quem decide se um membro comum pode reescrever os dados da empresa é a
-- política `workspaces_update`, não um `if` meu. Menos lugar onde eu preciso
-- estar certo.

create or replace function public.garantir_workspace_do_onboarding(
  p_nome text,
  p_segmento text default null,
  p_modelo_venda text default null,
  p_tamanho_equipe text default null
)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- A MAIS ANTIGA, mesma regra que `resolverWorkspaceAtivo` usa no app. Se as
  -- duas discordassem, o onboarding configuraria uma empresa e a pessoa cairia
  -- noutra ao entrar.
  select m.workspace_id into v_workspace
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = v_user
  order by w.created_at asc
  limit 1;

  if v_workspace is null then
    v_workspace := public.create_workspace_with_admin(p_nome);
  end if;

  -- `coalesce(nullif(...))` em cada campo: repetir a etapa com um campo em
  -- branco não pode apagar o que já foi respondido. Sem isso, voltar um passo
  -- e avançar de novo limparia o segmento.
  --
  -- Se quem chama não for admin, a RLS recusa e o update atinge zero linha,
  -- silenciosamente, que é o comportamento certo: o colaborador entra na
  -- empresa que já existe sem reescrever nada dela.
  update public.workspaces set
    name           = coalesce(nullif(btrim(p_nome), ''), name),
    segmento       = coalesce(nullif(btrim(p_segmento), ''), segmento),
    modelo_venda   = coalesce(nullif(btrim(p_modelo_venda), ''), modelo_venda),
    tamanho_equipe = coalesce(nullif(btrim(p_tamanho_equipe), ''), tamanho_equipe)
  where id = v_workspace;

  return v_workspace;
end;
$$;

revoke all on function public.garantir_workspace_do_onboarding(text, text, text, text) from public;
grant execute on function public.garantir_workspace_do_onboarding(text, text, text, text) to authenticated;

-- ============================================================================
-- 5. Backfill, ninguém que já usa pode acordar vendo onboarding
-- ============================================================================
--
-- Medido antes de escrever: 14 contas, 10 com empresa, 4 sem.
--
-- Quem já tem empresa nasce `completed` e com o tour pulado: essa pessoa já
-- conhece o produto, e recebê-la com um assistente de configuração seria
-- tratá-la como novata em cima de dados que ela mesma criou.
--
-- Quem tem conta e nenhuma empresa nasce `not_started`, que é a verdade: ela
-- nunca configurou nada. Vai ver o onboarding no próximo acesso, e é o que se
-- quer.
--
-- Quem se cadastrar depois desta migration não ganha linha aqui. O app trata
-- linha ausente como `not_started`, assim a leitura de toda página não paga
-- uma escrita, e a linha nasce no primeiro passo respondido.

insert into public.onboarding_state (user_id, status, tour_status)
select
  u.id,
  case when tem_empresa then 'completed' else 'not_started' end,
  case when tem_empresa then 'skipped' else 'not_started' end
from (
  select
    u.id,
    exists (select 1 from public.workspace_members m where m.user_id = u.id) as tem_empresa
  from auth.users u
) as u
on conflict (user_id) do nothing;

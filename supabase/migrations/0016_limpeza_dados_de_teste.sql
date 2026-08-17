-- LIMPEZA DE DADOS DE TESTE EM PRODUÇÃO
--
-- NÃO RODE ESTE ARQUIVO INTEIRO DE UMA VEZ. Ele está dividido em três níveis
-- de risco. Leia cada bloco, confira a listagem antes de apagar, e rode só o
-- que você quiser.
--
-- Motivo: o banco de produção acumulou workspaces de depuração e contas de
-- teste durante o desenvolvimento. Nada disso é dado de cliente, mas apagar é
-- irreversível, daí a separação por nível em vez de um `delete` só.
--
-- Todas as tabelas filhas (leads, deals, activities, workspace_members,
-- workspace_invites, subscriptions) têm `on delete cascade` para
-- `workspaces`, então remover o workspace leva o resto junto.

-- ============================================================================
-- NÍVEL 1, risco zero: workspaces órfãos, sem nenhum membro e sem nenhum dado
-- ============================================================================
--
-- Sobraram de tentativas de depurar a criação de workspace. Não têm membro
-- nenhum, então ninguém consegue acessá-los nem pela interface: são linhas
-- inalcançáveis ocupando espaço.
--
-- CONFIRA ANTES (deve listar exatamente 5, todos com 0 membros e 0 dados):

select w.id, w.name, w.created_at,
       (select count(*) from public.workspace_members m where m.workspace_id = w.id) as membros,
       (select count(*) from public.leads l where l.workspace_id = w.id) as leads,
       (select count(*) from public.deals d where d.workspace_id = w.id) as negocios
from public.workspaces w
where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id)
order by w.created_at;

-- Se a listagem acima bater, apague:
--
-- delete from public.workspaces w
-- where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id);

-- ============================================================================
-- NÍVEL 2, contas sintéticas de teste (@closify.dev)
-- ============================================================================
--
-- Workspaces cujos únicos membros usam e-mail @closify.dev, criado por mim
-- durante os testes de ponta a ponta. Não são pessoas reais.
--
-- CONFIRA ANTES:

select w.id, w.name, u.email
from public.workspaces w
join public.workspace_members m on m.workspace_id = w.id
join auth.users u on u.id = m.user_id
where u.email like '%@closify.dev'
order by w.name;

-- Se só aparecerem e-mails @closify.dev que você reconhece como teste:
--
-- delete from public.workspaces w
-- where exists (
--   select 1 from public.workspace_members m
--   join auth.users u on u.id = m.user_id
--   where m.workspace_id = w.id and u.email like '%@closify.dev'
-- );
--
-- Depois, os usuários de teste em si (opcional, e só faz sentido depois de
-- apagar os workspaces acima):
--
-- delete from auth.users where email like '%@closify.dev';

-- ============================================================================
-- NÍVEL 3, NÃO APAGUE SEM DECIDIR: contas com e-mail de pessoa real
-- ============================================================================
--
-- Estes têm e-mail de gente de verdade (inclusive o seu). Alguns têm nome de
-- teste ("kjjj", ",k jk", "ikljju"), mas o dono é uma conta real e pode ter
-- expectativa sobre o que está ali. Decisão sua, caso a caso.
--
-- CONFIRA:

select w.id, w.name, w.plan, u.email,
       (select count(*) from public.leads l where l.workspace_id = w.id) as leads,
       (select count(*) from public.deals d where d.workspace_id = w.id) as negocios
from public.workspaces w
join public.workspace_members m on m.workspace_id = w.id
join auth.users u on u.id = m.user_id
where u.email not like '%@closify.dev'
order by u.email, w.created_at;

-- ============================================================================
-- ITEM SEPARADO, "Agência Nova Era" tem Pro vitalício de graça
-- ============================================================================
--
-- Veio do `0002_seed.sql`, que rodou em produção: o workspace nasceu com
-- `plan = 'pro'` e uma subscription `status = 'active'` com
-- `asaas_subscription_id` NULO.
--
-- O problema não é o plano em si, é que ele é inalcançável pela cobrança:
-- nenhum evento do Asaas consegue rebaixá-lo, porque o webhook casa a
-- assinatura por `asaas_subscription_id` e ali não há id para casar. Ou seja,
-- Pro para sempre, sem pagar, sem forma de reverter pelo fluxo normal.
--
-- CONFIRA:

select w.id, w.name, w.plan, s.status, s.asaas_subscription_id, s.asaas_customer_id
from public.workspaces w
left join public.subscriptions s on s.workspace_id = w.id
where w.plan = 'pro';

-- Correção recomendada: rebaixar para free e remover a subscription fantasma,
-- deixando o workspace no mesmo estado de qualquer conta nova. Se um dia esse
-- usuário assinar de verdade, o fluxo cria tudo do zero corretamente.
--
-- update public.workspaces set plan = 'free'
-- where id = '98bdea6b-021d-4d17-87be-70e134fb8516';
--
-- delete from public.subscriptions
-- where workspace_id = '98bdea6b-021d-4d17-87be-70e134fb8516'
--   and asaas_subscription_id is null;

-- ============================================================================
-- PREVENÇÃO, impedir que o seed volte a rodar em produção
-- ============================================================================
--
-- A causa raiz é o `0002_seed.sql` ter sido aplicado no banco de produção.
-- Seed é para ambiente de desenvolvimento. Antes de criar qualquer novo
-- projeto Supabase, não aplique a 0002 fora do ambiente local.

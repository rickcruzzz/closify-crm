-- Duas mudanças no ciclo de cobrança, decididas pelo dono:
--
-- 1. Cortar cartão recusado em 24h, não em 3 dias.
-- 2. Avisar por e-mail nos 2 dias ANTES de vencer, coisa que nunca existiu.
--
-- ## Por que a graça não pode ser 24h para todo mundo
--
-- A 0027 criou `dias_para_compensacao_bancaria()` devolvendo 3, e o comentário
-- dela é explícito: NÃO é carência comercial, é o intervalo entre a pessoa
-- pagar e o Asaas avisar. Boleto e Pix levam até 3 dias úteis para compensar.
-- Cortar em 24h indistintamente derrubaria quem pagou o boleto no dia 30 com o
-- dinheiro já fora da conta, e essa pessoa abriria chamado tendo razão.
--
-- Cartão é outro caso: recusa é resposta imediata da adquirente, não há nada
-- compensando. 24h ali é folga suficiente para um retry do Asaas.
--
-- Daí a graça deixar de ser constante e passar a depender de COMO a pessoa
-- pagou. Medido antes de mexer, contra o banco de produção: a graça de 3 dias
-- estava mesmo viva (`pro_vigente` = true até 2,5 dias depois do vencimento,
-- false a partir de 3,5).
--
-- ## Por que a forma de pagamento precisa estar no banco
--
-- O checkout cria a assinatura com `billingType: 'UNDEFINED'`
-- (lib/asaas/actions.ts), de propósito: quem escolhe Pix, boleto ou cartão é o
-- cliente, na página do Asaas. E `pro_vigente()` é função SQL consultada a cada
-- checagem de limite, não pode sair chamando a API do Asaas. Então o tipo do
-- último pagamento passa a ser gravado aqui, pelo webhook e pelo job de
-- reconciliação, que já leem esse dado.

-- ============================================================================
-- 1. O que a assinatura passa a guardar
-- ============================================================================

alter table public.subscriptions
  -- Tipo do ÚLTIMO pagamento, no vocabulário do Asaas (CREDIT_CARD, BOLETO,
  -- PIX, UNDEFINED). Nulo é o estado de quem assinou e ainda não pagou
  -- nenhuma vez, ou de assinatura anterior a esta migration.
  add column if not exists ultimo_billing_type text,
  -- Quando o aviso de vencimento foi mandado pela última vez. É o que impede
  -- o job diário de mandar o mesmo e-mail duas vezes se rodar duas vezes no
  -- mesmo dia (retry da Vercel, execução manual). E-mail repetido de cobrança
  -- é o caminho curto para o cliente marcar o remetente como spam.
  add column if not exists aviso_vencimento_enviado_em timestamptz;

comment on column public.subscriptions.ultimo_billing_type is
  'billingType do último pagamento no Asaas. Decide a graça em dias_de_graca().';
comment on column public.subscriptions.aviso_vencimento_enviado_em is
  'Último aviso de vencimento enviado. Trava de idempotência do job diário.';

-- ============================================================================
-- 2. A graça, agora por forma de pagamento
-- ============================================================================

/**
 * Dias de tolerância depois do fim do período pago.
 *
 * Cartão recusado: 1 dia. A adquirente responde na hora, não há dinheiro em
 * trânsito, e 24h ainda cobrem um retry do Asaas.
 *
 * Boleto, Pix, UNDEFINED e nulo: 3 dias, o que a 0027 já praticava. Nulo cai
 * aqui de propósito: "não sei como essa pessoa pagou" não pode virar corte
 * mais agressivo, o erro barato é esperar um pouco mais.
 */
create or replace function public.dias_de_graca(p_billing_type text)
returns int
language sql
immutable
set search_path to ''
as $$
  select case
           when p_billing_type = 'CREDIT_CARD' then 1
           else 3
         end
$$;

revoke all on function public.dias_de_graca(text) from public, anon;
grant execute on function public.dias_de_graca(text) to authenticated, service_role;

-- `dias_para_compensacao_bancaria()` continua existindo, sem uso novo: outras
-- migrations a referenciam no histórico e removê-la quebraria quem replicar as
-- migrations em ordem. Fica marcada para não voltar a ser usada por engano.
comment on function public.dias_para_compensacao_bancaria() is
  'OBSOLETA desde a 0044. A graça agora depende da forma de pagamento, ver dias_de_graca(text).';

/**
 * O workspace tem Pro VÁLIDO agora?
 *
 * Mesma regra da 0027, com uma diferença: a tolerância sai de
 * `dias_de_graca(s.ultimo_billing_type)`, por assinatura, em vez da constante
 * de 3 dias.
 *
 * `current_period_end` nulo continua contando como VENCIDO, nunca como válido:
 * "não sei quando essa assinatura foi paga" não pode virar acesso liberado.
 *
 * Continua sendo a ÚNICA verdade sobre validade, e continua sem depender de
 * job nenhum: um plano vencido para de valer no instante em que alguém tenta
 * usá-lo. A 0027 explica por que não há cron aqui, e isso não mudou.
 */
create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.subscriptions s
     where s.workspace_id = target_workspace_id
       and s.status in ('active', 'past_due')
       and s.current_period_end is not null
       and s.current_period_end
           + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$$;

revoke all on function public.pro_vigente(uuid) from public, anon;
grant execute on function public.pro_vigente(uuid) to authenticated, service_role;

-- ============================================================================
-- 3. O webhook passa a gravar a forma de pagamento
-- ============================================================================

/**
 * Aplica no banco o que o Asaas avisou.
 *
 * Igual à versão da 0027, com um parâmetro novo e opcional: o `billingType` do
 * pagamento. Opcional (`default null`) porque a assinatura da função é chamada
 * de dois lugares (webhook e job de reconciliação) e um deploy que atualize a
 * migration antes do código não pode quebrar a chamada antiga.
 *
 * O tipo só é gravado quando vem preenchido: um `PAYMENT_OVERDUE` sem
 * billingType não pode apagar o tipo que o pagamento anterior já registrou,
 * senão a graça do cliente mudaria de 1 para 3 dias justamente na hora errada.
 */
create or replace function public.apply_asaas_subscription_status(
  p_asaas_subscription_id text,
  p_status public.subscription_status,
  p_billing_type text default null
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workspace_id uuid;
begin
  update public.subscriptions
     set status = p_status,
         -- Só pagamento move a validade. `past_due` e `canceled` deixam a data
         -- como está: é justamente ela que diz até quando o último pagamento
         -- comprou acesso.
         current_period_end = case
                                when p_status = 'active' then now() + interval '30 days'
                                else current_period_end
                              end,
         ultimo_billing_type = coalesce(p_billing_type, ultimo_billing_type),
         -- Período novo, aviso novo: zera a trava para que o job possa avisar
         -- de novo quando este período estiver perto do fim.
         aviso_vencimento_enviado_em = case
                                         when p_status = 'active' then null
                                         else aviso_vencimento_enviado_em
                                       end
   where asaas_subscription_id = p_asaas_subscription_id
  returning workspace_id into v_workspace_id;

  if v_workspace_id is null then
    return false;
  end if;

  update public.workspaces
     set plan = case
                  when public.pro_vigente(v_workspace_id) then 'pro'
                  else 'free'
                end::public.workspace_plan
   where id = v_workspace_id;

  return true;
end;
$function$;

-- A versão de 2 argumentos deixa de existir: com ela viva, `select
-- apply_asaas_subscription_status('x', 'active')` fica ambíguo entre as duas
-- sobrecargas e o Postgres recusa a chamada com "function is not unique". O
-- default do terceiro parâmetro já cobre quem chamar com dois.
drop function if exists public.apply_asaas_subscription_status(text, public.subscription_status);

-- Mesmas restrições que a 0014 aplicou à versão de dois argumentos: só o
-- webhook (service role) move status de cobrança. Se `authenticated` puder
-- chamar isto, qualquer pessoa logada vira Pro de graça.
revoke all on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) from public, anon, authenticated;
grant execute on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) to service_role;

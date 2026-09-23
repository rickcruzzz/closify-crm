-- # O tempo já pago não se perde, nos dois sentidos
--
-- Duas correções que parecem distintas e são a mesma: nas duas, o produto
-- encurtava acesso que já tinha sido comprado.
--
-- ## 1. `now()` apagava tempo pago quando o webhook chegava atrasado
--
-- `apply_asaas_subscription_status` escrevia
--
--     current_period_end = now() + intervalo_do_ciclo(ciclo)
--
-- `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` são DOIS eventos distintos do mesmo
-- pagamento, os dois em `ACTIVE_EVENTS`, com `event_id` diferente. O dedupe
-- não os junta, de propósito. O segundo a chegar reescrevia a validade a
-- partir de AGORA.
--
-- No anual: pagou 01/10, validade 01/10/2027; o evento irmão chega dia 15 e a
-- validade vira 15/10/2027. Catorze dias pagos, apagados, sem nada falhar.
--
-- `greatest(current_period_end, now())` diz a coisa certa: o ciclo novo começa
-- quando o anterior acaba, e só começa de agora se não havia anterior.
--
-- ## 2. Cancelar cortava o acesso na hora, contra os próprios Termos
--
-- `pro_vigente` ramo 1 exigia `status in ('active','past_due')`. Quem pagava
-- dia 1 e cancelava dia 3 perdia 27 dias pagos.
--
-- E os Termos publicados prometem o contrário, palavra por palavra em
-- `app/(legal)/termos`, seção 5: *"Você pode cancelar a assinatura quando
-- quiser, e o acesso ao plano pago permanece até o fim do período já pago.
-- Não há multa nem fidelidade."* O produto violava a própria promessa
-- publicada.
--
-- E a assimetria não foi decidida, só não foi vista: o caminho do dono
-- (`lib/dono/actions.ts`) faz o oposto de propósito e ZERA a data.
--
-- ### Por que uma COLUNA nova, e não aceitar `canceled` direto
--
-- `canceled` tem duas origens que pedem tratamento oposto:
--
--     o cliente pediu para parar    o dinheiro daquele ciclo FICOU conosco
--     estorno ou chargeback         o dinheiro VOLTOU
--
-- Aceitar `canceled` sem distinguir daria acesso pago a quem estornou. A
-- coluna guarda o FATO observado, na mesma forma de `sem_max_desde` (0091) e
-- de `vigia_ultimo_aviso` (0062), que é o padrão desta base para "isto
-- aconteceu, e quando".
--
-- Estorno não escreve a coluna, então continua cortando na hora. É o lado
-- seguro de errar.

alter table public.subscriptions
  add column if not exists cancelado_pelo_cliente_em timestamptz;

comment on column public.subscriptions.cancelado_pelo_cliente_em is
  'Quando o CLIENTE pediu para parar de renovar. Nulo em estorno e chargeback, que tambem produzem status canceled e NAO devem preservar acesso. Lido por assinatura_compra_acesso.';

-- A coluna nasce FORA de qualquer grant, pelo mesmo desenho da 0090: a tabela
-- só concede `select` a quem é membro, e nada da tela precisa lê-la.

-- ----------------------------------------------------------------- a validade

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
         --
         -- `greatest` e não `now()`: o ciclo novo começa quando o anterior
         -- termina. Ver o cabeçalho desta migration.
         current_period_end = case
                                when p_status = 'active'
                                  then greatest(
                                         coalesce(subscriptions.current_period_end, now()),
                                         now()
                                       ) + public.intervalo_do_ciclo(subscriptions.ciclo)
                                else current_period_end
                              end,
         -- Voltar a pagar LIMPA a marca de cancelamento. Sem isto, quem
         -- cancela e reassina carrega a marca velha para sempre, e o próximo
         -- estorno seria lido como cancelamento do cliente. Mesma razão do
         -- terceiro ramo da purga de instâncias na 0091.
         cancelado_pelo_cliente_em = case
                                       when p_status = 'active' then null
                                       else subscriptions.cancelado_pelo_cliente_em
                                     end,
         ultimo_billing_type = coalesce(p_billing_type, ultimo_billing_type),
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

revoke all on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) from public, anon, authenticated;
grant execute on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) to service_role;

-- -------------------------------------------------- quem ainda tem o plano
--
-- O predicado de "assinatura que compra acesso agora" ganhou um terceiro caso,
-- e ele é o mesmo nos três ramos de `pro_vigente` e no único de `max_vigente`.
-- Escrito quatro vezes seria a duplicação que esta mesma rodada está removendo
-- do TypeScript, e por isso ele nasce como função.

create or replace function public.assinatura_compra_acesso(
  s public.subscriptions
)
returns boolean
language sql
stable
set search_path to ''
as $fn$
  select s.current_period_end is not null
     and s.current_period_end
         + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
     and (
       s.status in ('active', 'past_due')
       -- Cancelou, e o período pago ainda não acabou. Estorno não entra aqui
       -- porque não escreve a coluna.
       or (s.status = 'canceled' and s.cancelado_pelo_cliente_em is not null)
     );
$fn$;

comment on function public.assinatura_compra_acesso(public.subscriptions) is
  'Esta assinatura compra acesso NESTE instante? Um lugar so, lido por pro_vigente e max_vigente. Inclui o cancelamento pedido pelo cliente ate o fim do periodo pago, como os Termos prometem, e exclui estorno.';

create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    -- 1. A assinatura desta empresa.
    exists (
      select 1
        from public.subscriptions s
       where s.workspace_id = target_workspace_id
         and public.assinatura_compra_acesso(s)
    )
    -- 2. O trial desta empresa.
    or exists (
      select 1
        from public.workspaces w
       where w.id = target_workspace_id
         and w.trial_ate is not null
         and w.trial_ate > now()
    )
    -- 3. A assinatura de QUALQUER empresa do mesmo dono.
    or exists (
      select 1
        from public.workspaces alvo
        join public.workspaces irma on irma.created_by = alvo.created_by
        join public.subscriptions s on s.workspace_id = irma.id
       where alvo.id = target_workspace_id
         and alvo.created_by is not null
         and public.assinatura_compra_acesso(s)
    );
$fn$;

comment on function public.pro_vigente(uuid) is
  'O Pro vale para ate cinco empresas do mesmo dono (created_by). O teto de cinco e aplicado na criacao, em criar_workspace_com_admin.';

create or replace function public.max_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
  select exists (
    select 1
      from public.subscriptions s
     where s.workspace_id = target_workspace_id
       and s.plano = 'max'
       and public.assinatura_compra_acesso(s)
  );
$fn$;

comment on function public.max_vigente(uuid) is
  'O Max vale so para a empresa que assinou: um ramo, sem trial e sem a cobertura por dono da 0078. Cada empresa conectada custa uma instancia paga no provedor de WhatsApp.';

-- Os grants, reafirmados mesmo com `create or replace` preservando-os: é o
-- hábito da casa, e o dia em que alguém trocar por `drop`+`create` sem reler
-- isto é o dia em que o grant some sem aviso.
revoke all on function public.pro_vigente(uuid) from public, anon;
grant execute on function public.pro_vigente(uuid) to authenticated, service_role;

revoke all on function public.max_vigente(uuid) from public, anon;
grant execute on function public.max_vigente(uuid) to authenticated, service_role;

revoke all on function public.assinatura_compra_acesso(public.subscriptions) from public, anon;
grant execute on function public.assinatura_compra_acesso(public.subscriptions) to authenticated, service_role;

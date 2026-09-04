-- O ciclo da assinatura, para o plano anual poder valer um ano.
--
-- ## O defeito que esta migration conserta
--
-- `apply_asaas_subscription_status` (0044) grava, em todo pagamento
-- confirmado:
--
--     current_period_end = now() + interval '30 days'
--
-- Trinta dias, literais, sem olhar o que foi pago. É a ÚNICA fonte de validade
-- de acesso para pagamento real no sistema inteiro. Com um plano anual
-- existindo, quem pagasse R$ 490 receberia trinta dias.
--
-- ## Por que o ciclo vem de uma COLUNA, e nunca do webhook
--
-- A 0027 registrou a regra em texto, e ela continua valendo: *"payload de
-- webhook é entrada externa, e derivar a validade do acesso a partir dele
-- deixaria alguém com o token estender o próprio plano."*
--
-- O ciclo é decidido pelo NOSSO servidor, em `createCheckout`, no mesmo
-- instante em que a assinatura nasce no Asaas — e é gravado ali. A RPC lê a
-- coluna. O webhook continua dizendo só "pagou", nunca quanto tempo.
--
-- Por isso `apply_asaas_subscription_status` NÃO ganha parâmetro de ciclo:
-- um parâmetro novo viria do chamador, e o chamador é o webhook. Ela lê o
-- ciclo da própria linha que já está atualizando.
--
-- ## Esta migration não muda NADA no dia em que sobe
--
-- `cycle: 'MONTHLY'` era literal em `lib/asaas/actions.ts` e foi o único
-- caminho de código que já criou assinatura neste projeto — conferido contra a
-- API do Asaas em 04/09, antes de escrever esta linha: toda assinatura da conta
-- é MONTHLY. Logo o default backfilla com o valor que a linha já tinha na
-- realidade, `intervalo_do_ciclo('MONTHLY')` devolve os mesmos 30 dias, e o
-- resultado é idêntico ao de hoje. Ela pode ir ao ar antes de existir qualquer
-- tela, e nada acontece.

alter table public.subscriptions
  add column if not exists ciclo text not null default 'MONTHLY';

-- `add constraint` não aceita `if not exists`; o bloco deixa a migration
-- reexecutável, mesmo padrão usado em outras migrations deste projeto.
do $$
begin
  alter table public.subscriptions
    add constraint subscriptions_ciclo_valido check (ciclo in ('MONTHLY', 'YEARLY'));
exception
  when duplicate_object then null;
end
$$;

-- Vocabulário do Asaas, cru e em maiúsculas, como `ultimo_billing_type` (0044)
-- guarda CREDIT_CARD/PIX. Um termo só do botão ao gateway à coluna: a
-- conferência contra `GET /subscriptions/{id}.cycle` vira igualdade de string,
-- sem tabela de tradução — e tabela de tradução é onde um bug de ciclo se
-- esconderia, porque erra em silêncio e nenhum teste de tipo a alcança.
comment on column public.subscriptions.ciclo is
  'MONTHLY ou YEARLY, no vocabulário do Asaas. Escrito por createCheckout junto do asaas_subscription_id a que pertence, e lido por intervalo_do_ciclo() para decidir a validade. Nunca vem do payload do webhook (ver 0027).';

/**
 * Quanto tempo de acesso um pagamento compra, por ciclo.
 *
 * Espelha a forma de `dias_de_graca(text)` (0044) de propósito — mesma
 * assinatura de uma linha, mesmo `immutable`, mesmo `search_path` vazio.
 *
 * ## A assimetria do default, que é deliberada
 *
 * `dias_de_graca` dá ao desconhecido o valor MAIOR (3 dias), benefício da
 * dúvida ao cliente, porque a diferença entre os ramos são dois dias.
 *
 * Aqui o desconhecido recebe o valor MENOR. A diferença entre os ramos são
 * ONZE MESES de produto de graça, e um ciclo que não reconheço não pode virar
 * um ano de acesso. Mesma forma, default oposto, e o motivo precisa estar
 * escrito ao lado — senão alguém "corrige" a inconsistência aparente.
 *
 * ## `interval '1 year'`, e não `365 days`
 *
 * O Asaas cobra o YEARLY na mesma data do calendário no ano seguinte. Em ano
 * bissexto, 365 dias encerrariam o acesso um dia ANTES de a próxima cobrança
 * sair: o cliente cortado com o dinheiro já pago. `interval '1 year'` cai na
 * data certa por construção, e é a mesma preocupação que fez a 0027 existir.
 *
 * ## O mensal continua 30 dias, não 1 mês
 *
 * Trocar para `interval '1 month'` moveria a data de vencimento de todo
 * cliente atual — em fevereiro, para menos. A 0027 escolheu 30 deliberadamente,
 * e mudar isso não é trabalho desta migration.
 */
create or replace function public.intervalo_do_ciclo(p_ciclo text)
returns interval
language sql
immutable
set search_path to ''
as $$
  select case
           when p_ciclo = 'YEARLY' then interval '1 year'
           else interval '30 days'
         end
$$;

revoke all on function public.intervalo_do_ciclo(text) from public, anon;
grant execute on function public.intervalo_do_ciclo(text) to authenticated, service_role;

/**
 * Aplica o status que o Asaas confirmou, e move a validade pelo CICLO da linha.
 *
 * Idêntica à versão da 0044, com uma única diferença: o `interval '30 days'`
 * literal virou `public.intervalo_do_ciclo(subscriptions.ciclo)`.
 *
 * A referência de coluna dentro do `set` lê o valor ANTIGO da linha, que é o
 * correto — este statement não altera `ciclo`, e o ciclo vigente é justamente
 * o que a assinatura tinha quando o pagamento aconteceu.
 *
 * MESMA ASSINATURA DE TRÊS ARGUMENTOS, de propósito. Acrescentar `p_ciclo`
 * criaria uma sobrecarga nova (a armadilha que a 0044 teve de resolver com
 * `drop function`, ver o comentário dela) e, pior, o valor viria do chamador —
 * que é o webhook. O ponto inteiro do desenho é que ele não decide duração.
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
                                when p_status = 'active'
                                  then now() + public.intervalo_do_ciclo(subscriptions.ciclo)
                                else current_period_end
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

-- Reafirmadas mesmo com `create or replace` preservando os grants: é o hábito
-- da casa, e o dia em que alguém trocar por `drop`+`create` sem reler isto é
-- o dia em que `authenticated` vira Pro de graça.
revoke all on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) from public, anon, authenticated;
grant execute on function public.apply_asaas_subscription_status(
  text, public.subscription_status, text
) to service_role;

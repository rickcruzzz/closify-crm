-- O plano Max: o primeiro recurso deste produto cujo custo NAO e zero.
--
-- ## Por que uma COLUNA e nao um terceiro valor no enum
--
-- `workspace_plan` e um enum de dois valores (`free`, `pro`), e `pro_vigente()`
-- devolve boolean. Sete lugares leem essa funcao:
--
--     0027  trigger que sincroniza workspaces.plan
--     0028  aceite de convite
--     0037  integration_connections, TRES policies
--     0050  limite de membros
--     0052  limite de contatos
--     0078  a regra das cinco empresas
--     0079  limite de orcamentos
--
-- Acrescentar `'max'` ao enum obrigaria a reler os sete, porque cada um
-- pergunta "e pro?" e passaria a precisar de "e pro OU max?". Um esquecido vira
-- cliente pagante de R$ 250 tomando o limite do Free na cara.
--
-- Com `subscriptions.plano`, `pro_vigente` **nao muda uma linha** e os sete
-- consumidores continuam certos por construcao: quem tem Max tem assinatura
-- viva, logo `pro_vigente` ja devolve `true` para ele pelo ramo 1. O Max
-- acrescenta direito, nunca substitui.
--
-- E `workspaces.plan` continua sendo `'pro'` para quem tem Max, de proposito: a
-- coluna e o cache do que `pro_vigente` respondeu, escrito pela RPC da 0070, e
-- ela nao e fonte de nada. A doutrina da 0027 nao se mexe.
--
-- ## O ramo que fica de fora, e ele e de DINHEIRO
--
-- `pro_vigente` (0078) tem tres ramos, e o terceiro diz: assinatura viva de
-- QUALQUER empresa do mesmo dono cobre ate cinco empresas. Faz sentido para o
-- Pro, cujo custo marginal por empresa e zero.
--
-- Nao faz para o Max. Cada empresa conectada consome uma instancia paga no
-- provedor de WhatsApp. Copiar o ramo 3 aqui daria a uma assinatura de R$ 250
-- o direito a CINCO instancias: receita fixa contra custo que multiplica por
-- cinco, e o produto perde dinheiro em cada cliente que crescer.
--
-- `max_vigente` fica com **o ramo 1 apenas**: a assinatura DESTA empresa.
--
-- ## O trial tambem fica de fora, pelo mesmo motivo
--
-- `workspaces.trial_ate` (ramo 2 do `pro_vigente`) da Pro de graca por um
-- periodo, e isso esta certo — Pro nao custa nada por conta nova. Max custa. Um
-- trial de Max seria uma instancia paga por cadastro, e bastaria cadastrar para
-- gastar.
--
-- Quem quiser experimentar o WhatsApp paga o primeiro mes. E o mesmo desenho do
-- resto do mercado, e e o unico que fecha a conta.
--
-- ## Esta migration nao muda NADA no dia em que sobe
--
-- O default e `'pro'`, e hoje toda assinatura da conta e Pro — conferido: nao
-- existe caminho de codigo que crie outra coisa. `max_vigente` devolve `false`
-- para todo mundo enquanto ninguem gravar `'max'`, e nada no produto a le
-- ainda. Ela pode ir ao ar antes de existir tela, e nada acontece.

-- ---------------------------------------------------------------------------
-- 1. A coluna
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists plano text not null default 'pro';

-- `add constraint` nao aceita `if not exists`; o bloco deixa a migration
-- reexecutavel, mesmo padrao da 0070.
do $$
begin
  alter table public.subscriptions
    add constraint subscriptions_plano_valido check (plano in ('pro', 'max'));
exception
  when duplicate_object then null;
end
$$;

-- Minusculo e em portugues, ao contrario de `ciclo` e `ultimo_billing_type`,
-- que guardam vocabulario do Asaas verbatim. A diferenca e proposital e tem
-- regra: termo que ATRAVESSA a fronteira do gateway fica no idioma dele, para a
-- conferencia virar igualdade de string crua; termo que e so nosso fica no
-- nosso. O Asaas nao conhece "plano" nenhum — para ele existem assinaturas com
-- valor, e quem da nome a faixa de valor somos nos.
comment on column public.subscriptions.plano is
  'pro ou max. Escrito por createCheckout junto do asaas_subscription_id a que pertence, e lido por max_vigente(). Nunca vem do payload do webhook (ver 0027).';

-- ---------------------------------------------------------------------------
-- 2. O direito, com a mesma forma de pro_vigente
-- ---------------------------------------------------------------------------

/**
 * O workspace tem Max VALIDO agora?
 *
 * Espelha `pro_vigente` de proposito — mesma assinatura de um argumento, mesmo
 * `stable`, mesmo `security definer`, mesma leitura de `dias_de_graca` — para
 * quem conhece uma reconhecer a outra sem reler.
 *
 * As duas diferencas estao no corpo, e as duas sao decisao escrita no cabecalho
 * desta migration:
 *
 *     `plano = 'max'`   o filtro novo
 *     um ramo so        sem o trial e sem a cobertura por dono (0078)
 *
 * `current_period_end` nulo conta como VENCIDO, nunca como valido. Mesma
 * escolha segura da 0027: "nao sei quando essa assinatura foi paga" nao pode
 * virar acesso liberado.
 *
 * A graca depois do vencimento CONTINUA valendo, e isso e deliberado. Ela
 * existe porque boleto e Pix levam dias para compensar, e cortar o WhatsApp de
 * quem ja pagou por causa da compensacao bancaria e o pior momento possivel
 * para o cliente: a caixa de entrada dele para de receber no meio de uma
 * conversa de venda.
 */
create or replace function public.max_vigente(target_workspace_id uuid)
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
       and s.plano = 'max'
       and s.status in ('active', 'past_due')
       and s.current_period_end is not null
       and s.current_period_end
           + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$$;

comment on function public.max_vigente(uuid) is
  'O Max vale so para a empresa que assinou: um ramo, sem trial e sem a cobertura por dono da 0078. Cada empresa conectada custa uma instancia paga no provedor de WhatsApp.';

-- `authenticated` executa porque a tela precisa saber se mostra o recurso, e
-- `anon` nao — pergunta sobre plano de empresa nao existe para quem nao entrou.
-- Mesmos grants de `pro_vigente`, e reafirmados mesmo com `create or replace`
-- preservando-os: e o habito da casa, e o dia em que alguem trocar por
-- `drop`+`create` sem reler isto e o dia em que o grant some sem aviso.
revoke all on function public.max_vigente(uuid) from public, anon;
grant execute on function public.max_vigente(uuid) to authenticated, service_role;

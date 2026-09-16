-- A conexão de WhatsApp de cada empresa, e a escada de entrega da mensagem.
--
-- ## Por que uma tabela nova, e não `integration_connections`
--
-- `integration_connections` (0034) parece o lugar óbvio: já tem
-- `unique (workspace_id, provider)`, já tem `'whatsapp'` no enum de provedor,
-- já tem token cifrado em repouso e já tem RLS por admin.
--
-- Não serve, e o motivo que decide não é o formato: **a 0037 gateia aquela
-- tabela em `pro_vigente()`, em TRÊS policies.** Guardar a conexão de WhatsApp
-- ali daria o recurso a quem paga Pro, e o Pro não cobre a instância paga que
-- cada empresa conectada consome. O gate erraria para o lado do dinheiro, em
-- silêncio, e a descoberta viria na fatura do provedor.
--
-- O formato também não bate: aquela tabela foi desenhada para OAuth
-- (`access_token_enc`, `refresh_token_enc`, `scopes`, `expires_at`), e aqui o
-- que existe é um par instância/token que nunca expira e um ciclo de vida de
-- conexão (QR lido, caiu, reconectou) que OAuth não tem.
--
-- ## O segredo do webhook, e por que ele mora aqui e não no `.env`
--
-- A Z-API **não assina o webhook**. O payload carrega `instanceId` em texto
-- puro, e mais nada. Resolver a empresa por esse campo repetiria, com outro
-- nome, o defeito que fez `c52a718` remover a rota da Evolution em 28/08:
--
-- > o `EVOLUTION_WEBHOOK_SECRET` é único para todas as empresas, então quem o
-- > conhecesse injetaria mensagem falsa no funil de qualquer uma sabendo o
-- > UUID dela
--
-- `segredo_do_webhook` é aleatório **por instância** e vai na URL que
-- configuramos na Z-API. A empresa é resolvida a partir dele, nunca do corpo.
-- Não existe campo de empresa na requisição, então não existe o que forjar:
-- quem não tem o segredo não alcança empresa nenhuma, e quem tem o de uma não
-- alcança a outra.
--
-- Um segredo no `.env` seria global de novo, e global é exatamente o que foi
-- removido.
--
-- ## O grant por COLUNA, e a armadilha que ele evita
--
-- `token_cifrado` e `segredo_do_webhook` nunca podem chegar ao navegador. A
-- forma ERRADA de impedir isso está registrada no `estado-atual`:
--
-- > `revoke select (coluna) ... from authenticated` sozinho **não bloqueia
-- > nada**. O Supabase concede `select` na TABELA INTEIRA por default
-- > privilege, e revogar uma coluna não subtrai de um grant mais amplo já
-- > concedido.
--
-- Foi assim que um admin leu `access_token_enc` pela API pública em 12/08,
-- apesar do `revoke` explícito na migration. A forma que funciona é a daqui:
-- revogar `select` da tabela inteira e conceder de volta **só** nas colunas
-- seguras.
--
-- ## Escrita só pela service role, como `subscriptions`
--
-- Nenhuma policy de insert, update ou delete para `authenticated`. Quem escreve
-- é a Server Action de conexão e o webhook, os dois pelo admin client.
--
-- E a trava de plano é TRIGGER, não Server Action: `service_role` ignora RLS e
-- **não ignora trigger**, e Server Action é endpoint HTTP que dá para chamar
-- sem passar pela tela. Três defeitos deste projeto vieram de esquecer isso
-- (0019, 0023, 0024).

-- ---------------------------------------------------------------------------
-- 1. A instância
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),

  -- `unique` e não só FK: uma empresa, um número. Dois números na mesma empresa
  -- exigiriam decidir por qual sai a resposta de cada conversa, e essa é uma
  -- pergunta de produto que ninguém fez ainda. O dia em que fizer, a coluna
  -- `canal` de `conversas` (0056) já está lá esperando.
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,

  -- `zapi` é o único hoje. A coluna existe pelo mesmo motivo de
  -- `conversas.canal`: a Cloud API oficial da Meta continua sendo o destino, e
  -- quando ela entrar as duas vão conviver por um tempo.
  provider text not null default 'zapi' check (provider in ('zapi')),

  -- O id da instância no provedor. Sozinho ele não chama nada (a URL da Z-API
  -- exige id E token), mas também não tem por que sair daqui: ele não está nos
  -- grants de coluna abaixo.
  instance_id text not null unique,

  -- Cifrado com `INTEGRATIONS_ENCRYPTION_KEY`, a mesma chave e o mesmo
  -- `lib/integrations/crypto.ts` que guardam o token do Google desde 12/08.
  token_cifrado text not null,

  -- O que identifica a empresa no webhook. Ver o cabeçalho.
  segredo_do_webhook text not null unique,

  -- O número conectado, como a Z-API o devolve (DDI+DDD+número, só dígitos).
  -- Anulável: só existe depois que o QR é lido.
  telefone text,

  -- Os cinco estados de `EstadoDaConexao` em `lib/plans/max.ts`, menos
  -- `desconhecido` — que é resposta de LEITURA falha, não estado guardado.
  -- Gravar "não sei" apagaria o último estado conhecido, que é justamente o que
  -- a tela precisa mostrar enquanto a leitura não volta.
  status text not null default 'ausente'
    check (status in ('ausente', 'conectando', 'conectado', 'desconectado', 'erro')),

  -- O que o provedor disse quando caiu, para a tela poder dizer em vez de só
  -- mostrar um X. Mesmo desenho de `mensagens.erro` (0056).
  ultimo_erro text,

  conectada_em timestamptz,
  desconectada_em timestamptz,
  -- Último sinal de vida vindo do provedor, por webhook ou por leitura de
  -- status. É o que separa "está conectado" de "achamos que está": uma
  -- instância que não dá sinal há horas merece uma conferência antes de a tela
  -- prometer que o WhatsApp está de pé.
  vista_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_instances enable row level security;

-- Membro lê, e não só admin: quem responde conversa precisa saber POR QUE o
-- envio está bloqueado. Sem isso, um membro veria a mensagem falhar sem nenhuma
-- explicação alcançável, e abriria chamado.
--
-- O que protege os segredos é o grant de coluna abaixo, não a policy.
drop policy if exists whatsapp_instances_select on public.whatsapp_instances;
create policy whatsapp_instances_select on public.whatsapp_instances
  for select using ((select public.is_workspace_member(workspace_id)));

-- Sem insert, update ou delete para `authenticated`, de propósito. Conectar e
-- desconectar passam pela Server Action, que usa o admin client depois de
-- checar plano e papel. Mesmo desenho de `subscriptions`.

-- ## O grant por coluna. Ver o cabeçalho para a armadilha que ele evita.
--
-- Revogar a tabela inteira PRIMEIRO é a parte que importa: o `grant` seguinte
-- passa a ser o único privilégio que existe, em vez de uma exceção dentro de um
-- privilégio mais amplo que continuaria valendo.
revoke select on public.whatsapp_instances from authenticated;
grant select (
  id, workspace_id, provider, telefone, status, ultimo_erro,
  conectada_em, desconectada_em, vista_em, created_at, updated_at
) on public.whatsapp_instances to authenticated;

comment on table public.whatsapp_instances is
  'Uma conexao de WhatsApp por empresa. segredo_do_webhook resolve a empresa na entrada do webhook, e nunca o instanceId do payload (ver 0090 e c52a718).';

comment on column public.whatsapp_instances.segredo_do_webhook is
  'Aleatorio POR INSTANCIA, vai na URL configurada na Z-API. E a identidade da empresa na entrada: nao existe campo de empresa no payload, entao nao existe o que forjar. Nunca sai para o navegador.';

-- ---------------------------------------------------------------------------
-- 2. Conectar exige Max, e a trava é trigger
-- ---------------------------------------------------------------------------

/**
 * Só empresa com Max vigente ganha instância.
 *
 * ## Por que trigger e não `if` na Server Action
 *
 * Server Action é endpoint HTTP, e dá para chamá-la sem passar pela tela. Três
 * defeitos deste projeto nasceram de regra que só vivia lá: autoupgrade para
 * Pro sem pagar (0019 a 0022), limite de contatos contornável (0023) e
 * autoconvite (0024).
 *
 * E `service_role` ignora RLS mas **não ignora trigger**. Como toda escrita
 * nesta tabela é pelo admin client, a trigger é a única barreira que resta —
 * a RLS não olha nada do que a Server Action faz.
 *
 * ## Só no INSERT, e isso é deliberado
 *
 * Criar conexão exige Max. MANTER uma que já existe, não: quando a assinatura
 * vence, o webhook continua precisando gravar `status` e `desconectada_em`, e
 * uma trigger de update travaria justamente a escrita que registra o que
 * aconteceu.
 *
 * Quem barra o envio de quem parou de pagar é `direitoAoWhatsapp`
 * (`lib/plans/max.ts`), que lê `max_vigente()` a cada tentativa. A linha
 * continuar na tabela não dá direito nenhum.
 *
 * ## E a linha NÃO é apagada quando o plano cai
 *
 * Pelo mesmo motivo que `podeLerConversas` devolve `true` sempre: apagar a
 * conexão obrigaria a ler o QR de novo depois de um boleto atrasado de dois
 * dias, e o número já estava pareado o tempo todo.
 */
create or replace function public.checar_max_para_conectar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.max_vigente(new.workspace_id) then
    raise exception 'O WhatsApp dentro do CRM e do plano Max. Assine para conectar um numero.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists whatsapp_instances_exige_max on public.whatsapp_instances;
create trigger whatsapp_instances_exige_max
  before insert on public.whatsapp_instances
  for each row execute function public.checar_max_para_conectar();

revoke all on function public.checar_max_para_conectar() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A escada de entrega da mensagem
-- ---------------------------------------------------------------------------
--
-- `mensagens.status` (0056) aceita três valores: `pendente`, `enviada` e
-- `falhou`. Eles bastavam para o Evolution, que só dizia se a chamada foi
-- aceita.
--
-- A Z-API manda `MessageStatusCallback` com CINCO estados — `SENT`,
-- `RECEIVED`, `READ`, `READ_BY_ME` e `PLAYED`. Sem este `alter`, o webhook de
-- status gravaria e tomaria `23514` **em silêncio**, e a tela mostraria toda
-- mensagem parada em "enviada" para sempre. É a mesma classe de defeito que a
-- 0086 existe para evitar: categoria fora do `check` não filtra errado, ela
-- recusa a linha inteira.
--
-- Os dois valores novos ficam em PORTUGUÊS, ao contrário de `subscriptions.ciclo`
-- e `ultimo_billing_type`, que guardam vocabulário do gateway verbatim. A regra
-- é a mesma da coluna `plano` na 0089: termo que ATRAVESSA a fronteira do
-- provedor fica no idioma dele, para a conferência virar igualdade de string;
-- termo que é nosso fica no nosso. Aqui `direcao` e `tipo` já são pt-BR, e a
-- tela lê estes valores direto.
--
-- `READ_BY_ME` e `PLAYED` caem em `lida`: os três significam que o outro lado
-- consumiu a mensagem, e três rótulos para um fato produziriam três ícones
-- diferentes dizendo a mesma coisa. O mapeamento é uma função pura com teste,
-- em `lib/whatsapp/entrega.ts`.

alter table public.mensagens
  drop constraint if exists mensagens_status_check;

alter table public.mensagens
  add constraint mensagens_status_check
  check (status in ('pendente', 'enviada', 'entregue', 'lida', 'falhou'));

comment on column public.mensagens.status is
  'pendente, enviada, entregue, lida ou falhou. A escada so anda para FRENTE: entrega fora de ordem e comum em webhook, e regredir de lida para entregue apagaria informacao verdadeira. Ver proximoStatusDeEntrega em lib/whatsapp/entrega.ts.';

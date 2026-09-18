-- Velo Funil, a reserva de instâncias de WhatsApp
--
-- ============================================================================
-- O defeito que isto fecha, e ele é de PRODUTO, não de código
-- ============================================================================
--
-- Hoje um cliente que paga R$ 250 pelo plano Max e clica em "Conectar" cai em
-- `pedirConexaoManual`: um e-mail sai para o dono, e daí em diante o caminho
-- depende de uma pessoa estar disponível. O dono cria a instância no painel da
-- Z-API, **manda o token por fora** e pede que o cliente cole num bloco
-- escrito *"Já tenho uma instância na Z-API"* — que é falso para ele, porque
-- quem criou fomos nós.
--
-- Isso não é o mesmo produto para todo pagante. É atendimento pessoal
-- disfarçado de recurso, e ele quebra no primeiro cliente que assina num
-- domingo.
--
-- ## Por que não resolver pelo Partner
--
-- O Partner da Z-API cria instância por API, e é o caminho limpo. Ele exige
-- **dez instâncias contratadas**, R$ 899,90/mês fixos, medido em 17/09. Com
-- zero cliente Max isso é pagar por vaga vazia, e o empate com a instância
-- avulsa só acontece no NONO cliente.
--
-- A reserva entrega o mesmo resultado para o cliente sem esse custo: o dono
-- compra avulso, uma de cada vez, e o dinheiro de quem paga financia a
-- próxima.
--
-- ============================================================================
-- 1. A tabela, e por que ela não é `whatsapp_instances`
-- ============================================================================
--
-- `whatsapp_instances.workspace_id` é `not null` E `unique`. Uma instância
-- comprada e ainda não entregue não tem empresa, então não cabe lá — e afrouxar
-- aquela coluna para caber seria trocar a trava que garante uma conexão por
-- empresa por um campo opcional que toda consulta precisaria lembrar de
-- filtrar.
--
-- Tabela separada também separa o CICLO DE VIDA: uma linha aqui nasce de uma
-- compra do dono e morre quando vira conexão de alguém.

create table if not exists public.whatsapp_reserva (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'zapi' check (provider = 'zapi'),
  instance_id text not null unique,
  token_cifrado text not null,
  -- Para o dono lembrar de qual compra é qual, quando a fatura chegar com
  -- várias linhas. Livre de propósito: é anotação, não chave.
  observacao text,
  created_at timestamptz not null default now(),
  -- Quando saiu da reserva e virou conexão de uma empresa. A linha NÃO é
  -- apagada: ela é o registro de que aquela instância foi entregue, e apagar
  -- deixaria a fatura com uma linha que nenhuma consulta explica.
  usada_em timestamptz,
  usada_por uuid references public.workspaces (id) on delete set null
);

-- A varredura pega sempre a mais antiga livre, e o índice parcial mantém isso
-- barato mesmo depois de a tabela acumular as já usadas.
create index if not exists whatsapp_reserva_livre_idx
  on public.whatsapp_reserva (created_at)
  where usada_em is null;

-- ============================================================================
-- 2. RLS ligada, ZERO policies
-- ============================================================================
--
-- Mesmo desenho de `error_logs`, `asaas_webhook_events` e `vigia_ultimo_aviso`.
-- Aqui a tabela guarda **token de instância cifrado**, que é credencial de
-- verdade: quem o tivesse mandaria mensagem em nome de um número de cliente.
--
-- Nenhum usuário lê, nenhum escreve. Quem toca é `service_role`, e o gate de
-- `localhost` da Central do Dono é a segunda porta do lado de quem cadastra.

alter table public.whatsapp_reserva enable row level security;

revoke all on public.whatsapp_reserva from authenticated, anon;

-- ============================================================================
-- 3. Puxar da reserva é UMA declaração, e isso é a correção de corrida
-- ============================================================================
--
-- Dois clientes clicando em "Conectar" no mesmo segundo leriam a mesma linha
-- livre e os dois receberiam a MESMA instância: um número de WhatsApp entregue
-- a duas empresas, com as mensagens de uma caindo na caixa da outra.
--
-- `for update skip locked` é o que impede: o segundo a chegar não espera o
-- primeiro (o que empataria a fila inteira), ele PULA a linha travada e pega a
-- seguinte. É a mesma família do `for update` que a 0026 usou no limite de
-- leads, com o `skip locked` a mais porque aqui cada linha é um objeto
-- distinto, e não um contador compartilhado.
--
-- Precisa ser RPC porque o PostgREST não expressa `for update skip locked`, e
-- fazer em dois passos pelo cliente reabre exatamente a corrida acima.

create or replace function public.puxar_da_reserva(p_workspace_id uuid)
returns table (instance_id text, token_cifrado text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  select r.id into v_id
  from public.whatsapp_reserva r
  where r.usada_em is null
  order by r.created_at
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  update public.whatsapp_reserva r
  set usada_em = now(), usada_por = p_workspace_id
  where r.id = v_id
  returning r.instance_id, r.token_cifrado
  into instance_id, token_cifrado;

  return next;
end;
$$;

-- `security definer` com `search_path` vazio, e EXECUTE revogado de todo mundo:
-- a função entrega credencial, e quem a chama é o servidor. A 0013 já pagou a
-- lição de que o Supabase concede `execute` a `public` por default privilege, e
-- que revogar depois de conceder é o único jeito que funciona.
revoke all on function public.puxar_da_reserva(uuid) from public, anon, authenticated;

comment on function public.puxar_da_reserva(uuid) is
  'Reserva atomicamente a instancia livre mais antiga para uma empresa. `for update skip locked` impede que dois cliques simultaneos recebam a MESMA instancia, que poria o numero de um cliente na caixa de outro.';

-- ============================================================================
-- 4. O que NÃO entra
-- ============================================================================
--
-- **Devolver para a reserva.** Se a empresa remover a conexão, a instância
-- volta ao dono e não à reserva: ela já foi pareada com um número, carrega a
-- sessão daquele cliente, e entregá-la a outra empresa sem limpar seria dar
-- acesso à conversa de quem saiu. Reaproveitar exige apagar no provedor
-- primeiro, e aí é compra nova.
--
-- **Teto de tamanho da reserva.** Quantas instâncias ficam paradas é decisão
-- comercial do dono, que paga por cada uma. Um teto no banco transformaria
-- essa escolha em erro de constraint num momento ruim.

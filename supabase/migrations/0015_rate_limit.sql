-- Rate limiting para as ações que um atacante pode repetir à vontade hoje:
-- login (força bruta de senha), convite de colaborador (uso do nosso Resend
-- como máquina de spam) e aceite de convite (adivinhação de token).
--
-- Sem Upstash nem Vercel KV: uma tabela no Postgres resolve neste volume, não
-- adiciona serviço externo ao stack, e sobrevive a restart de função, coisa
-- que um contador em memória não faz, porque cada instância serverless teria
-- o seu.

create table public.rate_limit_attempts (
  -- Chave composta pelo tipo de ação e pelo identificador (e-mail, token, IP).
  -- Ex: 'signin:pessoa@exemplo.com'. Nunca guarda senha nem conteúdo.
  chave text not null,
  ocorrido_em timestamptz not null default now(),
  primary key (chave, ocorrido_em)
);

-- A consulta é sempre "quantas tentativas desta chave depois de tal instante".
create index rate_limit_attempts_chave_ocorrido_idx
  on public.rate_limit_attempts (chave, ocorrido_em desc);

-- RLS ligada e sem policy nenhuma: só a service_role escreve e lê aqui, a
-- partir de Server Action. Nenhum client alcança, e um cliente que alcançasse
-- poderia apagar as próprias tentativas e anular o limite.
alter table public.rate_limit_attempts enable row level security;

-- ============================================================================
-- Registra a tentativa e devolve se estourou o limite
-- ============================================================================

-- Faz contagem e inserção na mesma chamada, dentro da mesma transação: em duas
-- chamadas separadas, duas requisições simultâneas leriam a mesma contagem
-- antiga e passariam as duas.
--
-- Devolve `true` quando a ação DEVE ser bloqueada.
create or replace function public.registrar_tentativa(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := now() - make_interval(secs => p_janela_segundos);
  v_total integer;
begin
  select count(*) into v_total
  from public.rate_limit_attempts
  where chave = p_chave
    and ocorrido_em > v_desde;

  if v_total >= p_limite then
    return true;
  end if;

  insert into public.rate_limit_attempts (chave) values (p_chave);

  -- Limpeza oportunista: apaga o que já saiu de qualquer janela em uso. Evita
  -- depender de pg_cron, que não está habilitado no projeto, e o custo é
  -- desprezível porque roda sobre o índice da própria chave.
  delete from public.rate_limit_attempts
  where chave = p_chave
    and ocorrido_em < now() - interval '1 day';

  return false;
end;
$$;

-- Chamada só por Server Action via service_role. Exposta a `anon` ou
-- `authenticated`, qualquer um poderia inflar o contador de outra pessoa e
-- deixá-la trancada para fora, negação de serviço contra usuário legítimo.
revoke all on function public.registrar_tentativa(text, integer, integer) from public;
revoke execute on function public.registrar_tentativa(text, integer, integer) from anon;
revoke execute on function public.registrar_tentativa(text, integer, integer) from authenticated;

-- ============================================================================
-- Zera as tentativas de uma chave
-- ============================================================================

-- Chamada depois de um login bem-sucedido: quem acertou a senha não deve
-- carregar as tentativas erradas anteriores.
create or replace function public.limpar_tentativas(p_chave text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limit_attempts where chave = p_chave;
$$;

revoke all on function public.limpar_tentativas(text) from public;
revoke execute on function public.limpar_tentativas(text) from anon;
revoke execute on function public.limpar_tentativas(text) from authenticated;

-- Contato repetido deixa de entrar, e a trava fica no BANCO.
--
-- Como era: só a importação de planilha conferia repetido, comparando contra o
-- workspace inteiro por `chaveDeContato` (lib/leads/planilha.ts). O cadastro
-- manual (`createLead`) inseria direto sem olhar nada, e a edição
-- (`updateLead`) deixava transformar um lead em cópia de outro. Nenhum índice
-- único existia em `leads`: conferido em produção, os únicos índices eram a
-- chave primária e os de busca.
--
-- Por que no banco e não só na Server Action: Server Action é endpoint HTTP, e
-- quem chama o PostgREST direto com a chave pública (que está no HTML por
-- design) pula a validação inteira. Este projeto já pagou por isso quatro
-- vezes, autoupgrade de plano (0019→0022), limite de leads (0023) e
-- autoconvite (0024), e a lição está escrita no CLAUDE.md: regra que só vive
-- na Server Action não é regra.
--
-- Aplicável agora sem limpeza prévia: contagem em produção antes desta
-- migration deu ZERO repetidos por e-mail e ZERO por telefone dentro do mesmo
-- workspace, com 28 leads.

-- ============================================================================
-- 1. A mesma normalização de telefone que o app usa
-- ============================================================================

/**
 * Só os dígitos, sem o 55 do país e sem o 0 de operadora.
 *
 * Espelho EXATO de `apenasDigitos` (lib/leads/planilha.ts). A ordem importa e
 * é a mesma dos dois lados: tira o 55 primeiro (e só quando sobra mais de 11
 * dígitos, senão um fixo de São Paulo começando em 55 perderia o DDD), depois
 * tira o 0 inicial. É o que faz "(71) 99999-1001", "+55 71 99999-1001" e
 * "71999991001" contarem como o mesmo contato.
 *
 * Se um dia `apenasDigitos` mudar, esta função tem que mudar junto: as duas
 * divergindo em silêncio deixaria o app aceitar o que o índice recusa, e o
 * cliente veria "Não foi possível criar o lead" sem explicação.
 *
 * `immutable` porque índice exige: o resultado depende só da entrada.
 */
create or replace function public.telefone_normalizado(bruto text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
           when digitos like '0%' then substring(digitos from 2)
           else digitos
         end
    from (
      select case
               when so_numeros like '55%' and length(so_numeros) > 11
                 then substring(so_numeros from 3)
               else so_numeros
             end as digitos
        from (select regexp_replace(coalesce(bruto, ''), '\D', '', 'g') as so_numeros) t1
    ) t2
$$;

revoke all on function public.telefone_normalizado(text) from public, anon;
grant execute on function public.telefone_normalizado(text) to authenticated, service_role;

-- ============================================================================
-- 2. As travas
-- ============================================================================

-- E-mail em minúsculas, por empresa.
--
-- PARCIAL de propósito: lead sem e-mail não pode colidir com outro lead sem
-- e-mail. A migration 0025 permitiu exatamente isso (lead com telefone e sem
-- e-mail), porque a planilha do público-alvo é lista de WhatsApp.
--
-- POR WORKSPACE e nunca global: duas empresas diferentes podem legitimamente
-- atender o mesmo cliente, e isolar por workspace é a mesma regra que a RLS já
-- aplica em todo o resto do produto.
create unique index if not exists leads_workspace_email_unico
  on public.leads (workspace_id, lower(email))
  where email is not null and email <> '';

-- Telefone normalizado, por empresa.
--
-- Só a partir de 8 dígitos, mesmo piso de `chaveDeContato`: abaixo disso não é
-- telefone, é resto de célula da planilha, e travar por isso agruparia
-- contatos diferentes.
create unique index if not exists leads_workspace_telefone_unico
  on public.leads (workspace_id, public.telefone_normalizado(phone))
  where phone is not null
    and length(public.telefone_normalizado(phone)) >= 8;

comment on index public.leads_workspace_email_unico is
  'Impede o mesmo e-mail duas vezes na mesma empresa. Ver createLead/updateLead e importarPlanilha.';
comment on index public.leads_workspace_telefone_unico is
  'Impede o mesmo telefone duas vezes na mesma empresa, normalizado como apenasDigitos faz no app.';

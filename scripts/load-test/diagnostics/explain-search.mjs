// Resolve o achado #2 com prova, não suposição: confirma se a busca de leads
// (ILIKE com wildcard à esquerda, lib/leads/queries.ts) usa o índice trigram
// (leads_name_trgm_idx / leads_company_trgm_idx, migration 0008) ou faz scan
// sequencial.
//
// PostgREST não expõe EXPLAIN, não é um SELECT, é um comando de meta consulta.
// Em vez de adicionar uma dependência nova só pra isto (driver `pg` com
// conexão direta), usa o mesmo padrão que o resto do projeto já usa pra coisas
// que a API não alcança: uma função SQL temporária, colada uma vez no SQL
// Editor do painel do Supabase (mesma mecânica de
// supabase/email-templates/README.md), chamada depois via RPC normal.
//
// Uso:
//   1. node scripts/load-test/diagnostics/explain-search.mjs --print-sql
//      e colar a saída no SQL Editor do projeto de STAGING (uma vez).
//   2. node --env-file=scripts/load-test/.env.staging scripts/load-test/diagnostics/explain-search.mjs
//   3. Quando terminar de usar: node .../explain-search.mjs --drop
import { createClient } from '@supabase/supabase-js'

const SQL_TEMPORARIA = `
-- Diagnóstico só-staging. DROP FUNCTION public._loadtest_explain(text); quando terminar.
create or replace function public._loadtest_explain(query text)
returns table (plano text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query execute 'explain (analyze, buffers, format text) ' || query;
end;
$$;
revoke execute on function public._loadtest_explain(text) from anon, authenticated;
`.trim()

if (process.argv.includes('--print-sql')) {
  console.log(SQL_TEMPORARIA)
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Rode primeiro: node explain-search.mjs --print-sql  (cole no SQL Editor do staging)')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

if (process.argv.includes('--drop')) {
  console.log('DROP é DDL, PostgREST não expõe isso, não dá pra automatizar por aqui.')
  console.log('Cole no SQL Editor do staging:\n')
  console.log('drop function if exists public._loadtest_explain(text);')
  process.exit(0)
}

async function explain(label, query) {
  const { data, error } = await admin.rpc('_loadtest_explain', { query })
  if (error) {
    console.error(`\n[${label}] RPC falhou: ${error.message}`)
    console.error('A função public._loadtest_explain existe no staging? Rode com --print-sql primeiro.')
    return
  }
  const plano = data.map((r) => r.plano).join('\n')
  const usaIndice = /Index (Scan|Only Scan).*trgm/i.test(plano) || /Bitmap Index Scan.*trgm/i.test(plano)
  const scanSequencial = /Seq Scan on (public\.)?leads/i.test(plano)

  console.log(`\n=== ${label} ===`)
  console.log(plano)
  console.log(`\nUsa índice trigram? ${usaIndice ? 'SIM' : 'NÃO'}`)
  console.log(`Faz Seq Scan em leads? ${scanSequencial ? 'SIM' : 'não'}`)
}

async function main() {
  // Pega um workspace do grupo "estresse", índice só importa em volume;
  // em 50 leads qualquer plano é rápido o bastante pra mascarar o problema.
  const { data: tenants } = await admin
    .from('workspaces')
    .select('id, name')
    .ilike('name', 'Loadtest estresse%')
    .limit(1)

  if (!tenants || tenants.length === 0) {
    console.error('Nenhum workspace "Loadtest estresse" encontrado, rode seed.mjs primeiro.')
    process.exit(1)
  }
  const workspaceId = tenants[0].id

  await explain(
    'ILIKE com wildcard à esquerda (o que a busca de leads faz hoje)',
    `select id from public.leads where workspace_id = '${workspaceId}' and (name ilike '%ana%' or company ilike '%ana%')`,
  )

  await explain(
    'ILIKE só com wildcard à direita (pra comparar, este SIM usa B-tree normal)',
    `select id from public.leads where workspace_id = '${workspaceId}' and name ilike 'ana%'`,
  )
}

main().catch((err) => {
  console.error('EXPLAIN-SEARCH FALHOU:', err.message)
  process.exit(1)
})

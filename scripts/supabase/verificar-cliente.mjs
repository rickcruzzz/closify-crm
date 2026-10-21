// Rode com node --env-file=.env.local scripts/supabase/verificar-cliente.mjs.
// Imprime só identificador público do projeto e códigos HTTP, nunca as chaves.
const urlCru = process.env.CLIENTE_SUPABASE_URL ?? process.env.url_supabase
const chavePublica =
  process.env.CLIENTE_SUPABASE_ANON_KEY ??
  process.env.supabase_public_key ??
  process.env.supbasae_anon_public_key
const chaveServico =
  process.env.CLIENTE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.supabase_secret_key ??
  process.env.supabasase_service_role_key

if (!urlCru || !chavePublica || !chaveServico) {
  throw new Error('Faltam URL, chave pública ou chave de serviço do Supabase do cliente.')
}

const url = new URL(urlCru)
if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
  throw new Error('URL do Supabase do cliente inválida.')
}
const ref = url.hostname.split('.')[0]
process.stdout.write(`Projeto do cliente: ${ref}\n`)

async function testar(rotulo, destino, headers) {
  try {
    const resposta = await fetch(destino, { headers, signal: AbortSignal.timeout(10_000) })
    process.stdout.write(`${rotulo}: HTTP ${resposta.status}\n`)
  } catch (erro) {
    process.stdout.write(`${rotulo}: falha de conexão (${erro instanceof Error ? erro.name : 'erro'})\n`)
  }
}

await testar('API pública', `${url.origin}/auth/v1/settings`, { apikey: chavePublica })
await testar('API administrativa', `${url.origin}/auth/v1/admin/users?per_page=1`, {
  apikey: chaveServico,
  Authorization: `Bearer ${chaveServico}`,
})
await testar('Tabela de empresas', `${url.origin}/rest/v1/workspaces?select=id&limit=1`, {
  apikey: chaveServico,
  Authorization: `Bearer ${chaveServico}`,
})
if (process.env.SUPABASE_ACCESS_TOKEN) {
  await testar('Acesso de gerenciamento existente', `https://api.supabase.com/v1/projects/${ref}`, {
    Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
  })
}

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Rode com node --env-file=.env.local scripts/supabase/migrar-cliente.mjs --plan
// e depois --apply. Usa a API oficial de migrations, que registra o histórico.
const aplicar = process.argv.includes('--apply')
if (!aplicar && !process.argv.includes('--plan')) {
  throw new Error('Escolha --plan ou --apply.')
}

const projetoUrl = process.env.CLIENTE_SUPABASE_URL ?? process.env.url_supabase
if (!projetoUrl) throw new Error('Falta a URL do Supabase do cliente.')
const url = new URL(projetoUrl)
if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
  throw new Error('URL do projeto do cliente inválida.')
}
const ref = url.hostname.split('.')[0]
const pasta = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const arquivos = (await readdir(pasta))
  .filter((nome) => /^\d{4}_[\w-]+\.sql$/.test(nome))
  .sort()
if (!arquivos.length) throw new Error('Nenhuma migration encontrada.')
process.stdout.write(`Projeto: ${ref}; migrations locais: ${arquivos.length}.\n`)
if (!aplicar) {
  process.stdout.write(`Primeira: ${arquivos[0]}; última: ${arquivos.at(-1)}.\n`)
  process.stdout.write('O seed de demonstração 0002 é inofensivo neste projeto.\n')
  process.exit(0)
}

const token = process.env.CLIENTE_SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('Falta CLIENTE_SUPABASE_ACCESS_TOKEN para aplicar migrations.')

async function api(path, options = {}) {
  const resposta = await fetch(`https://api.supabase.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(60_000),
  })
  const texto = await resposta.text()
  let dados
  try { dados = JSON.parse(texto) } catch { dados = texto }
  if (!resposta.ok) {
    throw new Error(`API Supabase HTTP ${resposta.status}: ${typeof dados === 'string' ? dados.slice(0, 500) : JSON.stringify(dados).slice(0, 500)}`)
  }
  return dados
}

const projeto = await api(`/v1/projects/${ref}`)
if (projeto.id !== ref) throw new Error('O token não corresponde ao projeto do cliente.')
process.stdout.write(`Acesso de gerenciamento confirmado: ${ref}.\n`)

const historico = await api(`/v1/projects/${ref}/database/migrations`)
const registros = Array.isArray(historico) ? historico : historico?.migrations ?? []
const aplicados = new Set(registros.map((m) => m.name).filter(Boolean))
if (registros.length && aplicados.size === 0) {
  throw new Error('Histórico remoto existe, mas o formato não pôde ser reconhecido. Nada foi aplicado.')
}

for (const arquivo of arquivos) {
  const nome = arquivo.slice(0, -4)
  if (aplicados.has(nome)) {
    process.stdout.write(`Já aplicada: ${nome}\n`)
    continue
  }
  const query = await readFile(join(pasta, arquivo), 'utf8')
  await api(`/v1/projects/${ref}/database/migrations`, {
    method: 'POST',
    body: JSON.stringify({ name: nome, query }),
  })
  process.stdout.write(`Aplicada: ${nome}\n`)
}

process.stdout.write('Histórico de migrations atualizado no projeto do cliente.\n')

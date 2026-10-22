import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Rode com node --env-file=.env.local scripts/supabase/migrar-cliente.mjs --plan
// e depois --apply --confirm-ref=<ref>. Usa a API oficial de migrations,
// que registra o histórico. Nunca aplica no projeto principal por acidente.
const aplicar = process.argv.includes('--apply')
const planejar = process.argv.includes('--plan')
if (aplicar === planejar) {
  throw new Error('Escolha --plan ou --apply.')
}

const projetoUrl = process.env.CLIENTE_SUPABASE_URL ?? process.env.url_supabase
if (!projetoUrl) throw new Error('Falta a URL do Supabase do cliente.')
const url = new URL(projetoUrl)
if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
  throw new Error('URL do projeto do cliente inválida.')
}
const ref = url.hostname.split('.')[0]
const projetoPrincipal = process.env.NEXT_PUBLIC_SUPABASE_URL
if (aplicar && projetoPrincipal && new URL(projetoPrincipal).hostname === url.hostname) {
  throw new Error('O destino coincide com o projeto principal. Aplicação recusada.')
}
const pasta = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const todosArquivos = (await readdir(pasta))
  .filter((nome) => /^(?:\d{4}|\d{14})_[\w-]+\.sql$/.test(nome))
  .sort()
const limite = process.argv
  .find((arg) => arg.startsWith('--through='))
  ?.slice('--through='.length)
if (
  limite &&
  (!/^(?:\d{4}|\d{14})$/.test(limite) ||
    !todosArquivos.some((nome) => nome.startsWith(`${limite}_`)))
) {
  throw new Error('--through precisa ser o número de uma migration local existente.')
}
const arquivos = limite
  ? todosArquivos.filter((nome) => nome.split('_', 1)[0] <= limite)
  : todosArquivos
if (!arquivos.length) throw new Error('Nenhuma migration encontrada.')
process.stdout.write(`Projeto: ${ref}; migrations locais: ${arquivos.length}.\n`)
process.stdout.write(`Primeira: ${arquivos[0]}; última: ${arquivos.at(-1)}.\n`)
process.stdout.write('A migration 0002 é um no-op; migrations não transferem dados.\n')

const token = process.env.CLIENTE_SUPABASE_ACCESS_TOKEN
if (!token) {
  if (planejar) {
    process.stdout.write(
      'Sem CLIENTE_SUPABASE_ACCESS_TOKEN: histórico remoto não verificado; pendências desconhecidas.\n',
    )
    process.exit(0)
  }
  throw new Error('Falta CLIENTE_SUPABASE_ACCESS_TOKEN para aplicar migrations.')
}

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
  try {
    dados = JSON.parse(texto)
  } catch {
    dados = texto
  }
  if (!resposta.ok) {
    throw new Error(
      `API Supabase HTTP ${resposta.status}: ${typeof dados === 'string' ? dados.slice(0, 500) : JSON.stringify(dados).slice(0, 500)}`,
    )
  }
  return dados
}

const projeto = await api(`/v1/projects/${ref}`)
if (projeto.id !== ref) throw new Error('O token não corresponde ao projeto do cliente.')
process.stdout.write(`Acesso de gerenciamento confirmado: ${ref}.\n`)

const historico = await api(`/v1/projects/${ref}/database/migrations`)
const registros = Array.isArray(historico) ? historico : (historico?.migrations ?? [])
const aplicados = new Set(registros.map((m) => m.name).filter(Boolean))
if (registros.length && aplicados.size === 0) {
  throw new Error(
    'Histórico remoto existe, mas o formato não pôde ser reconhecido. Nada foi aplicado.',
  )
}
const nomesLocais = new Set(arquivos.map((arquivo) => arquivo.slice(0, -4)))
const desconhecidas = [...aplicados].filter((nome) => !nomesLocais.has(nome))
if (desconhecidas.length) {
  throw new Error(
    `Histórico remoto contém migrations desconhecidas: ${desconhecidas.join(', ')}`,
  )
}
const pendentes = arquivos.filter((arquivo) => !aplicados.has(arquivo.slice(0, -4)))
process.stdout.write(
  `Remotas aplicadas: ${aplicados.size}; pendentes: ${pendentes.length}.\n`,
)
if (planejar) {
  for (const arquivo of pendentes) process.stdout.write(`Pendente: ${arquivo}\n`)
  process.exit(0)
}

const confirmacao = process.argv
  .find((arg) => arg.startsWith('--confirm-ref='))
  ?.slice('--confirm-ref='.length)
if (confirmacao !== ref) {
  throw new Error(`Confirme o destino com --confirm-ref=${ref} antes de aplicar.`)
}

// Uma lacuna anterior a uma migration já aplicada exige reconciliação manual.
const primeiraPendente = arquivos.findIndex(
  (arquivo) => !aplicados.has(arquivo.slice(0, -4)),
)
if (
  primeiraPendente >= 0 &&
  arquivos
    .slice(primeiraPendente + 1)
    .some((arquivo) => aplicados.has(arquivo.slice(0, -4)))
) {
  throw new Error('Histórico remoto fora de ordem. Reconcile antes de aplicar.')
}

for (const arquivo of pendentes) {
  const nome = arquivo.slice(0, -4)
  const query = await readFile(join(pasta, arquivo), 'utf8')
  await api(`/v1/projects/${ref}/database/migrations`, {
    method: 'POST',
    body: JSON.stringify({ name: nome, query }),
  })
  process.stdout.write(`Aplicada: ${nome}\n`)
  // A API atribui versões com precisão de segundos. Chamadas consecutivas no
  // mesmo segundo colidem na chave primária de schema_migrations.
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

const historicoFinal = await api(`/v1/projects/${ref}/database/migrations`)
const finais = Array.isArray(historicoFinal)
  ? historicoFinal
  : (historicoFinal?.migrations ?? [])
const nomesFinais = new Set(finais.map((m) => m.name).filter(Boolean))
const faltantes = arquivos.filter((arquivo) => !nomesFinais.has(arquivo.slice(0, -4)))
if (faltantes.length)
  throw new Error(`Aplicação terminou com ${faltantes.length} migration(s) ausente(s).`)
process.stdout.write(
  'Histórico remoto conferido: todas as migrations locais aplicadas.\n',
)

// Rode com node --env-file=.env.local scripts/deploy/verificar-vercel.mjs.
// Relata somente status, sem imprimir token nem variáveis de projeto.
const token = process.env.CLIENTE_VERCEL_TOKEN ?? process.env.VERCEL_TOKEN
const teamId = process.env.CLIENTE_VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID
const projectId = process.env.CLIENTE_VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID

if (!token || !teamId || !projectId) {
  throw new Error('Faltam token, time ou projeto da Vercel.')
}

async function consultar(path) {
  const resposta = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const corpo = await resposta.json().catch(() => ({}))
  return { status: resposta.status, corpo }
}

const escopo = `teamId=${encodeURIComponent(teamId)}`
const projeto = await consultar(`/v9/projects/${encodeURIComponent(projectId)}?${escopo}`)
process.stdout.write(`Projeto Vercel: HTTP ${projeto.status}\n`)
if (projeto.status === 200) {
  process.stdout.write(`Nome: ${projeto.corpo.name ?? 'desconhecido'}\n`)
  const implantacoes = await consultar(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&${escopo}&limit=1`)
  process.stdout.write(`Implantações: HTTP ${implantacoes.status}\n`)
  const ultima = implantacoes.corpo.deployments?.[0]
  if (ultima) process.stdout.write(`Última implantação: ${ultima.readyState ?? ultima.state ?? 'desconhecido'}\n`)
  const dominio = process.env.CLIENTE_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (dominio?.startsWith('https://')) {
    try {
      const publica = await fetch(dominio, { signal: AbortSignal.timeout(15_000), redirect: 'manual' })
      process.stdout.write(`Site público: HTTP ${publica.status}\n`)
    } catch {
      process.stdout.write('Site público: falha de conexão\n')
    }
  }
}

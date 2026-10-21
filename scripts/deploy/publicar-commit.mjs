// Rode com: node --env-file=.env.local scripts/deploy/publicar-commit.mjs <sha>
// Usa o GitHub conectado ao projeto Vercel; nunca imprime credenciais.
const token = process.env.VERCEL_TOKEN
const teamId = process.env.VERCEL_ORG_ID
const projectId = process.env.VERCEL_PROJECT_ID
const sha = process.argv[2]
if (!token || !teamId || !projectId || !/^[a-f0-9]{7,40}$/.test(sha ?? '')) {
  throw new Error('Faltam dados da Vercel ou o SHA do commit é inválido.')
}

const projetoResposta = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(20_000),
})
if (!projetoResposta.ok) throw new Error(`Projeto Vercel: HTTP ${projetoResposta.status}`)
const projeto = await projetoResposta.json()
if (projeto.name !== 'closify-crm-dr3t') throw new Error('Projeto Vercel inesperado.')

const resposta = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    name: projeto.name,
    project: projectId,
    target: 'production',
    gitSource: { type: 'github', repoId: 1318803572, ref: 'auditoria-23-09', sha },
  }),
  signal: AbortSignal.timeout(30_000),
})
const corpo = await resposta.json().catch(() => ({}))
process.stdout.write(`Criar implantação: HTTP ${resposta.status}\n`)
if (!resposta.ok) {
  process.stdout.write(`${corpo.error?.code ?? 'erro'}: ${corpo.error?.message ?? 'sem detalhe'}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`ID: ${corpo.id ?? 'não informado'}\n`)
  process.stdout.write(`Estado: ${corpo.readyState ?? corpo.status ?? 'criada'}\n`)
  process.stdout.write(`URL: ${corpo.url ?? 'não informada'}\n`)
}

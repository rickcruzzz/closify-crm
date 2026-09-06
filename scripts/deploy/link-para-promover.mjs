/**
 * Diz QUAL deployment promover, e recusa dizer quando não é seguro.
 *
 * ## O defeito que isto fecha
 *
 * Em 06/09 o dono promoveu três vezes seguidas o MESMO commit antigo
 * (`344c926`), porque o link que tinha em mãos era o de uma promoção anterior.
 * O painel da Vercel não avisa: a página do deployment velho continua válida,
 * o botão continua funcionando, e o resultado é "promovi" com produção parada
 * onde estava. A correção que importava ficou fora do ar por três rodadas.
 *
 * O link certo muda a cada push. Guardá-lo em qualquer lugar — histórico do
 * navegador, mensagem antiga — é a receita para repetir o erro.
 *
 * ## Por que não dá para promover por aqui
 *
 * Medido em 06/09, mesmo commit, mudando só o alvo:
 *
 *     POST /v10/projects/{id}/promote/{uid}   alvo=production  ->  201
 *     POST /v10/projects/{id}/promote/{uid}   alvo=staging     ->  422
 *
 * O gate cria os deployments com alvo `staging` — é o que permite testá-los
 * sem tocar em produção — e é exatamente essa classe que a API recusa. O
 * clique no painel continua sendo o único caminho. Este script não promove:
 * ele garante que o clique caia no lugar certo.
 *
 * Uso: `npm run promover`
 */

const TOKEN_VERCEL = process.env.VERCEL_TOKEN
const TIME = process.env.VERCEL_ORG_ID
const PROJETO = process.env.VERCEL_PROJECT_ID
const TOKEN_GITHUB = process.env.GITHUB_PUSH_TOKEN
const REPO = 'rickcruzzz/closify-crm'
const PAINEL = 'https://vercel.com/ricks-projects-1e819723/closify-crm-dr3t'

function faltando(nome) {
  console.error(`Falta ${nome} no .env.local. Rode com: node --env-file=.env.local`)
  process.exit(1)
}
if (!TOKEN_VERCEL) faltando('VERCEL_TOKEN')
if (!TOKEN_GITHUB) faltando('GITHUB_PUSH_TOKEN')

const vercel = async (rota) => {
  const r = await fetch(`https://api.vercel.com${rota}`, {
    headers: { Authorization: `Bearer ${TOKEN_VERCEL}` },
  })
  if (!r.ok) throw new Error(`Vercel ${rota} -> ${r.status}`)
  return r.json()
}
const github = async (rota) => {
  const r = await fetch(`https://api.github.com/repos/${REPO}${rota}`, {
    headers: { Authorization: `Bearer ${TOKEN_GITHUB}`, Accept: 'application/vnd.github+json' },
  })
  if (!r.ok) throw new Error(`GitHub ${rota} -> ${r.status}`)
  return r.json()
}

const curto = (sha) => (sha ?? '').slice(0, 7)

const commits = await github('/commits?sha=main&per_page=1')
const topo = commits[0]
const shaTopo = topo.sha
const assunto = topo.commit.message.split('\n')[0]

const { deployments } = await vercel(
  `/v6/deployments?projectId=${PROJETO}&teamId=${TIME}&limit=20`,
)

const emProducao = deployments.find((d) => d.target === 'production' && d.aliasAssigned)
// O que o gate testou: alvo `staging`, pronto, e do commit do topo.
const auditado = deployments.find(
  (d) => d.target === 'staging' && d.state === 'READY' && d.meta?.githubCommitSha === shaTopo,
)

const execucoes = await github('/actions/runs?per_page=20')
const rodada = execucoes.workflow_runs.find((w) => w.head_sha === shaTopo)

console.log('')
console.log(`  topo de main   ${curto(shaTopo)}  ${assunto}`)
console.log(
  `  em producao    ${curto(emProducao?.meta?.githubCommitSha)}  (${emProducao?.uid ?? '?'})`,
)
console.log(`  auditoria      ${rodada ? `${rodada.status} / ${rodada.conclusion ?? '-'}` : 'nao encontrada'}`)
console.log('')

if (emProducao?.meta?.githubCommitSha === shaTopo) {
  console.log('  Producao JA esta no commit do topo. Nada a promover.')
  process.exit(0)
}
if (!rodada || rodada.status !== 'completed') {
  console.log('  A auditoria ainda esta rodando. Espere terminar — promover antes')
  console.log('  pula justamente o portao que impede codigo nao testado de subir.')
  console.log(`  Acompanhe: ${rodada?.html_url ?? 'https://github.com/' + REPO + '/actions'}`)
  process.exit(2)
}
if (rodada.conclusion !== 'success') {
  console.log(`  A auditoria REPROVOU (${rodada.conclusion}). NAO promova.`)
  console.log(`  Veja o que falhou: ${rodada.html_url}`)
  process.exit(3)
}
if (!auditado) {
  console.log('  A auditoria passou, mas o deployment dela ainda nao esta pronto.')
  console.log('  Rode de novo em um minuto.')
  process.exit(2)
}

console.log('  Auditoria passou. Promova ESTE, e nenhum outro:')
console.log('')
console.log(`  ${PAINEL}/${auditado.uid.replace(/^dpl_/, '')}`)
console.log('')
console.log('  Na pagina, confira que o commit no topo e ' + curto(shaTopo) + ',')
console.log('  depois menu (...) no canto superior direito -> Promote to Production.')
console.log('')

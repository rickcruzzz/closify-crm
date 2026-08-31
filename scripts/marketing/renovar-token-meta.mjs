/**
 * Troca o token curto do Graph API Explorer por um de ~60 dias.
 *
 *     node --env-file=.env.local scripts/marketing/renovar-token-meta.mjs
 *
 * Lê `META_INSTAGRAM_TOKEN` do ambiente, troca, e imprime o novo para colar de
 * volta. Não escreve no `.env.local` sozinho de propósito: sobrescrever
 * credencial por script é o tipo de automação que apaga a única cópia boa no
 * dia em que a troca falhar no meio.
 *
 * ## Por que isto existe
 *
 * O Explorer emite token de usuário que vive 1 a 2 horas. Medido em 31/08:
 * gerado às 23h, morto à 01h, com `error_subcode: 463`. Entre uma coisa e
 * outra, a publicação no Instagram e a Central de anúncio pararam juntas — e
 * o sintoma não é "expirou", é a API respondendo como se a permissão tivesse
 * sumido.
 *
 * Sessenta dias não é para sempre. O que não expira é token de **usuário do
 * sistema**, que exige verificação do negócio, que exige CNPJ ativo. Enquanto
 * essa fila não anda, renovar a cada dois meses é o preço.
 */

const APP_ID = (process.env.META_APP_ID ?? '').trim()
const APP_SECRET = (process.env.META_APP_SECRET ?? '').trim()
const CURTO = (process.env.META_INSTAGRAM_TOKEN ?? '').trim()

function exigir(condicao, mensagem) {
  if (!condicao) {
    console.error(`\n  ${mensagem}\n`)
    process.exit(1)
  }
}

exigir(APP_ID, 'META_APP_ID vazio no .env.local.')
exigir(APP_SECRET, 'META_APP_SECRET vazio. developers.facebook.com > budsiness > Configurações > Básico.')
exigir(CURTO, 'META_INSTAGRAM_TOKEN vazio — gere um no Explorer primeiro.')

const parametros = new URLSearchParams({
  grant_type: 'fb_exchange_token',
  client_id: APP_ID,
  client_secret: APP_SECRET,
  fb_exchange_token: CURTO,
})

const resposta = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${parametros}`)
const corpo = await resposta.json()

if (!resposta.ok) {
  console.error(`\n  troca falhou: HTTP ${resposta.status}`)
  console.error(`  ${corpo?.error?.message ?? JSON.stringify(corpo)}\n`)
  // O erro mais comum aqui é o token curto JÁ ter expirado — a troca precisa
  // de um token vivo. Nesse caso não há o que renovar: gere outro no Explorer.
  if (corpo?.error?.code === 190) {
    console.error('  O token curto já expirou. Gere outro no Graph API Explorer')
    console.error('  e rode isto em seguida, sem esperar.\n')
  }
  process.exit(1)
}

const { access_token: longo, expires_in: segundos } = corpo
const dias = segundos ? Math.round(segundos / 86400) : null

// Confere ANTES de mandar colar: token que não responde não vale a troca.
const teste = await fetch(
  `https://graph.facebook.com/v23.0/me/permissions?access_token=${encodeURIComponent(longo)}`,
)
const perm = await teste.json()
const concedidas = (perm.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission)

console.log(`\n  token novo: ${dias ? `${dias} dias` : 'sem prazo informado'}`)
console.log(`  permissões: ${concedidas.length ? concedidas.join(', ') : '(nenhuma — algo saiu errado)'}`)
console.log(`\n  Cole nas DUAS variáveis do .env.local:\n`)
console.log(`META_INSTAGRAM_TOKEN=${longo}`)
console.log(`META_ADS_TOKEN=${longo}`)
console.log()

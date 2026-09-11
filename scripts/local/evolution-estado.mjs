/**
 * Estado da instancia da Evolution, e o webhook dela.
 *
 * ## Por que isto existe
 *
 * `docs/agente-de-operacao.md:230` registra a lacuna desde 06/09: *"Estado da
 * instancia da Evolution: sessao caida nao gera aviso nenhum"*. De fora, sessao
 * caida e "ninguem mandou mensagem" sao o mesmo silencio — o mesmo defeito que
 * o webhook do Asaas teve tres vezes em cinco dias.
 *
 * Em 11/09 isso custou um diagnostico as cegas: o fluxo do n8n falhou com 404
 * em `sendText/{instancia}`, e 404 ali quer dizer que a instancia com AQUELE
 * NOME nao existe mais — nao que ela esteja desconectada (desconectada devolve
 * 400). Sem este script, distinguir as duas exige abrir o painel.
 *
 * ## Uso
 *
 *     node --env-file=.env.local scripts/local/evolution-estado.mjs
 *     node --env-file=.env.local scripts/local/evolution-estado.mjs --ligar-webhook
 *
 * Exige `EVOLUTION_API_KEY` no `.env.local` (a `AUTHENTICATION_API_KEY` do
 * servico `8_evolution-api` no EasyPanel). Ela NAO vai para a Vercel: nada do
 * produto fala com a Evolution — `FASE_DO_WHATSAPP` esta em `'migrando'` — e
 * isto e ferramenta de operacao, nao codigo de producao.
 */

const BASE = process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const KEY = process.env.EVOLUTION_API_KEY

/**
 * O webhook precisa do endereco INTERNO do n8n? Nao.
 *
 * Quem chama e a Evolution, e ela fala com o n8n pela rede do Docker. Mas o
 * endereco publico tambem resolve de dentro, e usar o publico deixa o valor
 * conferivel de fora — que e o ponto de um script de diagnostico.
 */
const WEBHOOK = process.env.SDR_WEBHOOK_URL ?? 'https://8-n8n.zohnng.easypanel.host/webhook/sdr-whatsapp'

/**
 * So `messages.upsert`.
 *
 * A Evolution manda TODO evento quando a lista fica vazia, incluindo presenca e
 * `chats.update`, e cada um vira uma execucao no n8n que morre no filtro. Com
 * centenas de eventos por hora, o historico de execucoes fica ilegivel
 * justamente quando alguem precisa dele para investigar.
 */
const EVENTOS = ['MESSAGES_UPSERT']

const ligarWebhook = process.argv.includes('--ligar-webhook')

if (!KEY) {
  console.error(
    'Falta EVOLUTION_API_KEY no .env.local.\n' +
      'Ela e a AUTHENTICATION_API_KEY do servico 8_evolution-api no EasyPanel\n' +
      '(aba Environment). Cole no arquivo, nunca no chat.',
  )
  process.exit(1)
}

const api = async (caminho, init = {}) => {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { apikey: KEY, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const texto = await r.text()
  let corpo = null
  try {
    corpo = texto ? JSON.parse(texto) : null
  } catch {
    corpo = texto
  }
  return { status: r.status, corpo }
}

const raiz = await api('/')
console.log(`  Evolution ${raiz.corpo?.version ?? '?'} — HTTP ${raiz.status}`)

const lista = await api('/instance/fetchInstances')
if (lista.status !== 200) {
  console.error(`  /instance/fetchInstances -> ${lista.status}`)
  console.error('  Chave recusada. Confira a AUTHENTICATION_API_KEY no EasyPanel.')
  process.exit(1)
}

const instancias = Array.isArray(lista.corpo) ? lista.corpo : (lista.corpo?.instances ?? [])
if (!instancias.length) {
  console.log('\n  NENHUMA INSTANCIA. Crie uma no manager e escaneie o QR:')
  console.log(`  ${BASE}/manager`)
  process.exit(0)
}

console.log(`\n  ${instancias.length} instancia(s):\n`)
for (const bruta of instancias) {
  // A forma do objeto mudou entre as versoes 1.x e 2.x: em algumas ele vem
  // embrulhado em `instance`, em outras vem plano. Ler os dois evita um script
  // que quebra sozinho no proximo upgrade do container.
  const i = bruta.instance ?? bruta
  const nome = i.instanceName ?? i.name
  const estado = i.connectionStatus ?? i.status ?? i.state
  const numero = i.owner ?? i.number ?? i.ownerJid ?? '—'

  const sinal = estado === 'open' ? 'CONECTADA' : estado === 'connecting' ? 'AGUARDANDO QR' : 'DESCONECTADA'
  console.log(`  [${sinal}] ${nome}`)
  console.log(`     numero: ${numero}`)
  console.log(`     estado bruto: ${estado}`)

  const wh = await api(`/webhook/find/${encodeURIComponent(nome)}`)
  const cfg = wh.corpo ?? {}
  const urlAtual = cfg.url ?? cfg.webhook?.url ?? null
  const ativo = cfg.enabled ?? cfg.webhook?.enabled ?? false
  const eventos = cfg.events ?? cfg.webhook?.events ?? []

  console.log(`     webhook: ${ativo ? 'ligado' : 'DESLIGADO'} -> ${urlAtual ?? '(nenhum)'}`)
  if (eventos.length) console.log(`     eventos: ${eventos.join(', ')}`)

  const precisaArrumar = !ativo || urlAtual !== WEBHOOK
  if (precisaArrumar && !ligarWebhook) {
    console.log('     >>> o webhook NAO aponta para o n8n. Rode com --ligar-webhook para corrigir.')
  }

  if (precisaArrumar && ligarWebhook) {
    // `webhookByEvents: false` de proposito: com `true` a Evolution acrescenta
    // o nome do evento ao caminho (`/sdr-whatsapp/messages-upsert`), e o n8n
    // devolve 404 porque o path registrado e exatamente `sdr-whatsapp`.
    const posto = await api(`/webhook/set/${encodeURIComponent(nome)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: { enabled: true, url: WEBHOOK, webhookByEvents: false, events: EVENTOS },
      }),
    })
    console.log(`     >>> webhook regravado: HTTP ${posto.status}`)

    const conferido = await api(`/webhook/find/${encodeURIComponent(nome)}`)
    const c = conferido.corpo ?? {}
    console.log(`     >>> conferido: ${(c.url ?? c.webhook?.url) ?? '(vazio)'}`)
  }

  if (estado !== 'open') {
    console.log(`     >>> escaneie o QR: ${BASE}/manager  (instancia "${nome}")`)
  }
  console.log('')
}

console.log('  O nome da instancia importa: o fluxo do n8n monta a URL de envio')
console.log('  com o `instance` que VEM no webhook, entao um nome novo funciona')
console.log('  sozinho — desde que o webhook acima esteja apontado para o n8n.')

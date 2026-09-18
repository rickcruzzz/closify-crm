/**
 * Espera um deployment da Vercel ficar READY, de verdade.
 *
 * ## O defeito que isto substitui, achado em 18/09
 *
 * O workflow tinha `run: sleep 90`. Noventa segundos fixos, e depois o
 * Playwright batia na URL do preview.
 *
 * **`sleep` nao e esperar, e torcer.** Neste dia o build ficou mais de VINTE E
 * CINCO MINUTOS na fila de sistema da Vercel (`isInSystemBuildsQueue: true`,
 * lido na resposta da API). Aos 90 segundos a URL ainda nao existia, a
 * auditoria rodou contra o nada, e o gate PASSOU.
 *
 * A prova nao e teorica: as quatro rodadas anteriores duraram 6m05, 5m57, 6m00
 * e 6m42. Constante, independente do tempo de build. O gate estava medindo a si
 * mesmo.
 *
 * E um gate que passa sem testar e pior que gate nenhum, porque ele publica o
 * link de promocao dizendo "auditoria passou". E a mesma classe do
 * `conferir-documentos.mjs` que saia com codigo 0 sem as credenciais, e do
 * `sem-travessao` que lia `lastIndex` de uma regex compartilhada.
 *
 * ## O que ele faz
 *
 * Pergunta o estado ate ser READY, e falha em qualquer outro desfecho. Sem
 * teto de tempo o job penduraria para sempre; com teto, a falha DIZ que foi
 * espera e nao auditoria, que sao coisas diferentes para quem le o log.
 */

const token = process.env.VERCEL_TOKEN
const teamId = process.env.VERCEL_TEAM_ID
const deploymentId = process.argv[2]
const TETO_MINUTOS = Number(process.env.TETO_DE_ESPERA_MIN ?? 25)
const INTERVALO_MS = 10_000

/**
 * ## `process.exitCode` e nao `process.exit()`, e isso NAO e estilo
 *
 * `process.exit()` dentro de um modulo com top-level await derruba o processo
 * no meio de um handle aberto. No Windows isso estoura o libuv
 * (`UV_HANDLE_CLOSING`) e o codigo de saida vira **127** — nem 0 nem 1.
 *
 * Medido aqui em 18/09: o script acertava a leitura, imprimia a mensagem
 * certa, e saia 127 nos DOIS casos. Num gate, 127 e falha sempre: o workflow
 * reprovaria um preview perfeito e ninguem saberia por que.
 *
 * Com `exitCode` o processo termina sozinho, depois de fechar o que abriu.
 */
if (!token || !deploymentId) {
  console.error('Uso: esperar-deployment.mjs <deploymentId>  (exige VERCEL_TOKEN)')
  process.exitCode = 1
}

const alvo = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`)
if (teamId) alvo.searchParams.set('teamId', teamId)

const comeco = Date.now()
const limite = comeco + TETO_MINUTOS * 60_000
let ultimo = ''

async function esperar() {
  while (Date.now() < limite) {
    const r = await fetch(alvo, { headers: { Authorization: `Bearer ${token}` } })

    if (!r.ok) {
      // Falha de LEITURA nao e falha do build: a API engasga, e desistir aqui
      // reprovaria um deployment que pode estar perfeito. Tenta de novo.
      console.log(`  (API respondeu ${r.status}, tentando de novo)`)
      await new Promise((s) => setTimeout(s, INTERVALO_MS))
      continue
    }

    const j = await r.json()
    const estado = j.readyState ?? j.status

    if (estado !== ultimo) {
      const fila = j.isInSystemBuildsQueue ? ' (na fila de sistema da Vercel)' : ''
      console.log(`  ${estado}${fila}`)
      ultimo = estado
    }

    if (estado === 'READY') {
      console.log(`Pronto em ${Math.round((Date.now() - comeco) / 1000)}s.`)
      return 0
    }

    if (estado === 'ERROR' || estado === 'CANCELED') {
      console.error(`O build terminou como ${estado}. A auditoria NAO rodou.`)
      if (j.errorMessage) console.error(j.errorMessage.slice(0, 500))
      return 1
    }

    await new Promise((s) => setTimeout(s, INTERVALO_MS))
  }

  // A mensagem distingue os dois desfechos de proposito: "a auditoria reprovou"
  // e "o build nao ficou pronto" pedem acoes opostas, e um `sleep` fazia os dois
  // virarem a mesma coisa.
  console.error(
    `O build nao ficou pronto em ${TETO_MINUTOS} minutos. A auditoria NAO rodou, e isso NAO quer dizer que o codigo esta errado.`,
  )
  return 1
}

if (process.exitCode !== 1) {
  process.exitCode = await esperar()
}

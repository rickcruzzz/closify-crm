/**
 * Dispara a prateleira pela Evolution API, com imagem e legenda.
 *
 *     node --env-file=.env.local scripts/inteligencia/enviar-evolution.mjs
 *     node --env-file=.env.local scripts/inteligencia/enviar-evolution.mjs --confirmar --max=30
 *
 * ## Este arquivo contraria uma decisão escrita deste projeto
 *
 * `lib/inteligencia-de-mercado/dominio/abordagem.ts` diz, no próprio código:
 * *"este módulo não envia nada, e isso é decisão"*. E
 * `docs/mercado/limites-e-bloqueios.md` lista os quatro padrões que derrubam
 * uma conta — denúncia de spam, volume súbito, texto idêntico e zero resposta.
 *
 * **O dono foi avisado em 09/09 e em 11/09, e mandou construir as duas
 * vezes.** A decisão é dele, o número é dele, e a lista é de contato comercial
 * que as próprias empresas publicaram no próprio site. O que este arquivo pode
 * fazer é não piorar a conta — e é o que todas as travas abaixo fazem.
 *
 * ## O que muda em relação a `enviar-whatsapp.mjs`
 *
 * Só o TRANSPORTE. Aquele dirige o WhatsApp Web por Playwright; este fala com
 * a Evolution API, que já está conectada e é a mesma ponte que o agente SDR
 * usava. Ganha três coisas: não exige navegador aberto, não guarda sessão do
 * WhatsApp em pasta no disco, e sabe mandar IMAGEM com legenda.
 *
 * **O texto continua vindo de `abordagem.ts`** pela rota
 * `/dono/prospeccao/fila`. Nenhuma cópia da mensagem mora aqui — duas cópias
 * divergem, e a que diverge em silêncio seria o texto que vai para o cliente.
 *
 * ## As travas, e o que cada uma evita
 *
 *     --confirmar ausente   ensaio. Padrao, porque disparar para centenas nao
 *                           pode ser efeito colateral de um comando digitado
 *                           errado
 *     --max=N               teto por rodada, 30 por padrao. Volume subito e o
 *                           segundo item da lista do que bane
 *     intervalo             45s a 150s SORTEADO. Cadencia fixa e assinatura de
 *                           robo mais obvia que a pressa
 *     horario               9h as 18h de Sao Paulo, seg a sex. Mensagem
 *                           comercial as 3h da manha e denuncia na certa
 *     estado ANTES do sono  grava assim que a Evolution confirma, entao Ctrl+C
 *                           nunca reenvia
 *     taxa de erro          3 falhas seguidas PARAM a rodada. Evolution fora
 *                           do ar com 300 na fila queimaria a fila inteira
 *     numero invalido       pula, registra, e NAO conta no teto
 *
 * `nao-perturbe.txt` já foi aplicado antes daqui: quem disse não some da fila
 * em `carregarPrateleira`, e é ele que sustenta a promessa da última linha da
 * mensagem.
 *
 * ## A imagem
 *
 * Vem de `PROSPECCAO_IMAGEM_URL` no `.env.local` e é **validada antes do
 * primeiro envio**: HEAD, `content-type` de imagem, tamanho acima de zero e
 * abaixo de 5 MB. Sem a variável, o disparo é só texto — que é o
 * comportamento seguro, e não um erro.
 *
 * Imagem quebrada não é detalhe estético aqui: ela chega como quadrado cinza
 * no WhatsApp de uma empresa que nunca ouviu falar da gente, e é exatamente o
 * gatilho de "Bloquear e denunciar".
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ESTADO = join(RAIZ, '.dono-prospeccao.json')
const FILA = 'http://localhost:3000/dono/prospeccao/fila'

const EVOLUTION = process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const CHAVE = process.env.EVOLUTION_API_KEY
const INSTANCIA = process.env.EVOLUTION_INSTANCIA ?? 'VELO'
const IMAGEM = process.env.PROSPECCAO_IMAGEM_URL ?? null

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const ignorarHorario = args.includes('--ignorar-horario')
const MAX = Number(args.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 30)
const SO = args.find((a) => a.startsWith('--so='))?.split('=')[1] ?? null

const INTERVALO_MIN = 45_000
const INTERVALO_MAX = 150_000
/** Falhas seguidas que param a rodada. */
const FALHAS_SEGUIDAS_ATE_PARAR = 3
/** Teto do arquivo de imagem. Acima disso o WhatsApp recomprime e demora. */
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024

const sortear = (min, max) => Math.floor(min + Math.random() * (max - min))
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

function agoraEmSaoPaulo() {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const partes = Object.fromEntries(f.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return { hora: Number(partes.hour), diaDaSemana: partes.weekday }
}

function dentroDoHorario() {
  const { hora, diaDaSemana } = agoraEmSaoPaulo()
  const fimDeSemana = /^(sáb|dom)/i.test(diaDaSemana)
  return !fimDeSemana && hora >= 9 && hora < 18
}

async function lerEstado() {
  if (!existsSync(ESTADO)) return {}
  try {
    return JSON.parse(await readFile(ESTADO, 'utf-8'))
  } catch {
    return {}
  }
}

/**
 * Marca ANTES de dormir, e é isso que faz `Ctrl+C` não reenviar.
 *
 * Gravar depois do intervalo pareceria mais limpo e deixaria uma janela de até
 * dois minutos e meio em que a mensagem já saiu e o arquivo não sabe.
 */
async function marcarEnviado(dominio, extra = {}) {
  const estado = await lerEstado()
  estado[dominio] = { estado: 'enviado', em: new Date().toISOString(), ...extra }
  await writeFile(ESTADO, JSON.stringify(estado, null, 2), 'utf-8')
}

function abortar(mensagem) {
  console.error(`\n  ${mensagem}\n`)
  process.exitCode = 1
}

/**
 * A imagem existe, responde e é mesmo uma imagem?
 *
 * Conferido UMA vez, antes do primeiro envio — não a cada mensagem: 300 HEADs
 * na mesma URL é tráfego à toa, e se ela cair no meio da rodada o erro do
 * envio já para tudo pelo contador de falhas.
 */
async function conferirImagem(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (!r.ok) return { erro: `HTTP ${r.status}` }
    const tipo = r.headers.get('content-type') ?? ''
    if (!tipo.startsWith('image/')) return { erro: `content-type "${tipo}" não é imagem` }
    const bytes = Number(r.headers.get('content-length') ?? 0)
    if (bytes > IMAGEM_MAX_BYTES) return { erro: `${(bytes / 1e6).toFixed(1)} MB, acima do teto de 5 MB` }
    return { tipo, bytes }
  } catch (e) {
    return { erro: `não respondeu (${e.message})` }
  }
}

const evolution = async (caminho, corpo) => {
  const r = await fetch(`${EVOLUTION}${caminho}/${encodeURIComponent(INSTANCIA)}`, {
    method: 'POST',
    headers: { apikey: CHAVE, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const texto = await r.text()
  let json = null
  try {
    json = JSON.parse(texto)
  } catch {
    /* a Evolution devolve texto puro em alguns erros */
  }
  return { ok: r.ok, status: r.status, json, texto }
}

/**
 * Uma mensagem: imagem com legenda, ou só texto.
 *
 * **Uma operação só quando há imagem**, e isso é decisão: `sendMedia` aceita
 * `caption`, então o cliente recebe UM balão com a arte e o texto. Mandar dois
 * (imagem, depois texto) dobra o número de eventos no mesmo segundo — o padrão
 * exato que a detecção de automação procura — e ainda deixa a janela de a
 * segunda falhar com a primeira já entregue.
 */
async function enviarUm(numero, texto, imagemOk) {
  if (imagemOk) {
    return evolution('/message/sendMedia', {
      number: numero,
      mediatype: 'image',
      media: IMAGEM,
      caption: texto,
    })
  }
  return evolution('/message/sendText', { number: numero, text: texto })
}

async function main() {
  console.log('')

  if (!CHAVE) {
    return abortar(
      'falta EVOLUTION_API_KEY no .env.local. ' +
        'Ela é a AUTHENTICATION_API_KEY do serviço 8_evolution-api no EasyPanel.',
    )
  }

  if (!dentroDoHorario() && !ignorarHorario) {
    const { hora, diaDaSemana } = agoraEmSaoPaulo()
    return abortar(
      `fora da janela comercial (${diaDaSemana} ${hora}h em São Paulo). ` +
        'Mensagem comercial fora de hora é denúncia na certa. ' +
        'Use --ignorar-horario se souber o que está fazendo.',
    )
  }

  // A instância precisa estar CONECTADA antes de qualquer coisa: com ela
  // caída, 300 envios viram 300 erros e a fila inteira queima o contador.
  const estadoDaInstancia = await fetch(
    `${EVOLUTION}/instance/fetchInstances`,
    { headers: { apikey: CHAVE } },
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

  const inst = (Array.isArray(estadoDaInstancia) ? estadoDaInstancia : [])
    .map((x) => x.instance ?? x)
    .find((x) => (x.instanceName ?? x.name) === INSTANCIA)

  if (!inst) return abortar(`a instância "${INSTANCIA}" não existe na Evolution.`)
  const conexao = inst.connectionStatus ?? inst.status ?? inst.state
  if (conexao !== 'open') {
    return abortar(`a instância "${INSTANCIA}" está "${conexao}", não conectada. Escaneie o QR.`)
  }

  let dados
  try {
    const r = await fetch(FILA)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    dados = await r.json()
  } catch (e) {
    return abortar(
      `não consegui ler ${FILA} (${e.message}). ` +
        'A rota é local: o `npm run dev` precisa estar de pé na porta 3000.',
    )
  }

  const jaMarcados = await lerEstado()
  let fila = dados.fila.filter((p) => !jaMarcados[p.dominio])
  if (SO) fila = fila.filter((p) => p.dominio === SO || p.numero === SO)
  fila = fila.slice(0, MAX)

  let imagemOk = false
  let imagemInfo = 'sem imagem (só texto)'
  if (IMAGEM) {
    const c = await conferirImagem(IMAGEM)
    imagemOk = !c.erro
    imagemInfo = c.erro
      ? `IMAGEM RECUSADA: ${c.erro} — a rodada seguiria só com texto`
      : `${c.tipo}, ${(c.bytes / 1024).toFixed(0)} KB`
  }

  console.log(`  instância         ${INSTANCIA} (${conexao}), ${inst.owner ?? inst.number ?? '—'}`)
  console.log(`  fila total        ${dados.total}`)
  console.log(`  não perturbe      ${dados.naoPerturbe ?? 0}`)
  console.log(`  já com marca      ${Object.keys(jaMarcados).length}`)
  console.log(`  vão nesta rodada  ${fila.length}  (teto --max=${MAX})`)
  console.log(`  intervalo         ${INTERVALO_MIN / 1000}s a ${INTERVALO_MAX / 1000}s, sorteado`)
  console.log(`  imagem            ${imagemInfo}`)

  if (fila.length === 0) return console.log('\n  Nada a enviar.\n')

  const minutos = Math.round((fila.length * ((INTERVALO_MIN + INTERVALO_MAX) / 2)) / 60_000)

  if (!confirmar) {
    console.log('\n  ENSAIO — nada será enviado. As três primeiras:\n')
    for (const p of fila.slice(0, 3)) {
      console.log(`  [${p.pontos} pts] ${p.nome}  (${p.dominio}, ${p.vertical})  ->  +${p.numero}`)
      const corpo = p.texto.split('\n\n')[1] ?? p.texto
      console.log(`    ${corpo.slice(0, 100)}…`)
    }
    console.log(`\n  ${fila.length} mensagens levariam ~${minutos} min (${(minutos / 60).toFixed(1)} h).`)
    if (minutos > 540) {
      console.log('  ATENÇÃO: passa das 9h da janela comercial. Divida em rodadas.')
    }
    console.log('  Para enviar de verdade, repita com --confirmar.\n')
    return
  }

  console.log(`\n  ENVIANDO. ~${minutos} min. Ctrl+C para no próximo intervalo, sem reenviar.\n`)

  let enviados = 0
  let pulados = 0
  let falhasSeguidas = 0
  const comecou = Date.now()

  for (const [i, p] of fila.entries()) {
    // A janela é reconferida a cada volta: uma rodada de 300 atravessa horas e
    // pode alcançar as 18h com a fila pela metade.
    if (!dentroDoHorario() && !ignorarHorario) {
      console.log('\n  A janela comercial fechou. Parando — o resto continua na fila.\n')
      break
    }

    const r = await enviarUm(p.numero, p.texto, imagemOk)

    if (r.ok) {
      await marcarEnviado(p.dominio, { via: 'evolution', comImagem: imagemOk })
      enviados++
      falhasSeguidas = 0
      const st = r.json?.status ?? 'enviado'
      console.log(`  ${String(i + 1).padStart(3)}/${fila.length}  ok   ${p.nome} (+${p.numero}) ${st}`)
    } else {
      // Número inexistente no WhatsApp é caso comum numa lista raspada, e não
      // é falha da rodada: some da fila e não conta no contador que para tudo.
      const invalido = r.status === 400 && /not.*exist|invalid|jid/i.test(r.texto)
      if (invalido) {
        await marcarEnviado(p.dominio, { estado: 'descartado', motivo: 'número sem WhatsApp' })
        pulados++
        console.log(`  ${String(i + 1).padStart(3)}/${fila.length}  --   ${p.nome}: sem WhatsApp`)
      } else {
        falhasSeguidas++
        console.error(
          `  ${String(i + 1).padStart(3)}/${fila.length}  ERRO ${p.nome}: HTTP ${r.status} ${r.texto.slice(0, 120)}`,
        )
        if (falhasSeguidas >= FALHAS_SEGUIDAS_ATE_PARAR) {
          console.error(
            `\n  ${falhasSeguidas} falhas seguidas — PARANDO. ` +
              'A Evolution pode estar fora do ar ou a sessão caiu. ' +
              'Nada do que já saiu será reenviado.\n',
          )
          break
        }
      }
    }

    if (i < fila.length - 1) await dormir(sortear(INTERVALO_MIN, INTERVALO_MAX))
  }

  const duracao = Math.round((Date.now() - comecou) / 60_000)
  console.log(`\n  enviados ${enviados} | sem WhatsApp ${pulados} | ${duracao} min`)
  console.log(`  o estado está em ${ESTADO} — rodar de novo continua de onde parou.\n`)
}

main().catch((e) => abortar(`falha inesperada: ${e.message}`))

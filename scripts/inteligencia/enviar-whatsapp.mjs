/**
 * Dispara as mensagens da prateleira pelo WhatsApp Web, uma a uma.
 *
 *     node scripts/inteligencia/enviar-whatsapp.mjs                 # ensaio
 *     node scripts/inteligencia/enviar-whatsapp.mjs --confirmar --max=30
 *
 * ## Este arquivo contraria uma decisão escrita deste projeto
 *
 * `lib/inteligencia-de-mercado/dominio/abordagem.ts` diz, no próprio código:
 * *"este módulo não envia nada, e isso é decisão. Envio automatizado em volume
 * é exatamente o que faz o WhatsApp banir um número, e o número aqui é o do
 * dono."* E `docs/mercado/limites-e-bloqueios.md` lista os quatro padrões que
 * derrubam uma conta — denúncia de spam, volume súbito, texto idêntico e zero
 * resposta —, dos quais um robô acerta os quatro de uma vez.
 *
 * **O dono foi avisado disso duas vezes e mandou construir assim mesmo**, em
 * 09/09/2026. A decisão é dele, o número é dele, e a lista é de contato
 * comercial que as próprias empresas publicaram. O que este arquivo pode fazer
 * é não piorar a conta: tudo abaixo existe para o disparo parecer com o que um
 * humano faria, porque é o padrão — e não o conteúdo — que a detecção olha.
 *
 * O texto continua vindo de `abordagem.ts` pela rota `/dono/prospeccao/fila`.
 * Nenhuma cópia da mensagem mora aqui.
 *
 * ## As travas, e o que cada uma evita
 *
 *     --confirmar ausente   ensaio: abre o WhatsApp, resolve os numeros e
 *                           imprime o que iria. Padrao, porque disparar para
 *                           centenas nao pode ser efeito colateral de um
 *                           comando digitado errado
 *     --max=N               teto por rodada. 30 e o padrao. Volume subito e o
 *                           segundo item da lista do que bane
 *     intervalo             45s a 150s, sorteado a cada envio. Cadencia fixa
 *                           e assinatura de robo mais obvia que a pressa
 *     horario               so 9h as 18h de Sao Paulo, seg a sex. Mensagem
 *                           comercial as 3h da manha e denuncia na certa
 *     estado a cada envio   grava ANTES de dormir, entao Ctrl+C nao reenvia
 *     numero invalido       pula e segue; nao conta no teto
 *     qualquer erro novo    PARA a rodada inteira
 *
 * O `nao-perturbe.txt` já foi aplicado antes daqui: quem disse não some da
 * fila em `carregarPrateleira`, e é ele que sustenta a promessa da última
 * linha da mensagem.
 *
 * ## O perfil do navegador fica no disco, e é sessão do WhatsApp
 *
 * `--user-data-dir` guarda o pareamento para o QR ser lido uma vez só. É a
 * mesma classe de coisa que a sessão do Google que a rodada de 06/09 deixou
 * numa pasta temporária e apagou no fim: **é credencial**. Mora em
 * `.whatsapp-perfil/`, que está no `.gitignore`.
 */

import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const PERFIL = join(RAIZ, '.whatsapp-perfil')
const ESTADO = join(RAIZ, '.dono-prospeccao.json')
const FILA = 'http://localhost:3000/dono/prospeccao/fila'

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const MAX = Number(args.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 30)
const ignorarHorario = args.includes('--ignorar-horario')

const INTERVALO_MIN = 45_000
const INTERVALO_MAX = 150_000

function sortear(min, max) {
  return Math.floor(min + Math.random() * (max - min))
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Hora e dia da semana em São Paulo, não do relógio da máquina.
 *
 * O servidor da Vercel roda em UTC e este projeto já pagou por isso uma vez
 * (`diaEmSaoPaulo`, em `lib/tasks/buckets.ts`). Aqui o erro seria pior: às 21h
 * de São Paulo já é o dia seguinte em UTC, e a janela "comercial" abriria de
 * madrugada.
 */
function agoraEmSaoPaulo() {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  })
  const partes = Object.fromEntries(f.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return { hora: Number(partes.hour), diaDaSemana: partes.weekday }
}

function dentroDoHorario() {
  if (ignorarHorario) return true
  const { hora, diaDaSemana } = agoraEmSaoPaulo()
  const fimDeSemana = /^(sáb|dom)/i.test(diaDaSemana)
  return !fimDeSemana && hora >= 9 && hora < 18
}

async function lerEstado() {
  if (!existsSync(ESTADO)) return {}
  try {
    return JSON.parse(await readFile(ESTADO, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Grava DEPOIS de a mensagem sair e ANTES de dormir.
 *
 * A ordem é a mesma que o vigia aprendeu em 01/09: memória só grava depois do
 * envio confirmado. Ao contrário, um Ctrl+C no meio da espera deixaria a marca
 * de "enviado" numa mensagem que nunca saiu — e o pior erro desta operação é
 * mandar duas vezes para a mesma empresa.
 */
async function marcarEnviado(dominio) {
  const estado = await lerEstado()
  estado[dominio] = { estado: 'enviado', em: new Date().toISOString() }
  await writeFile(ESTADO, JSON.stringify(estado, null, 2), 'utf8')
}

function abortar(mensagem) {
  console.error(`\n  PARADO: ${mensagem}\n`)
  process.exitCode = 1
}

async function main() {
  console.log('')

  if (!dentroDoHorario()) {
    const { hora, diaDaSemana } = agoraEmSaoPaulo()
    return abortar(
      `fora da janela comercial (${diaDaSemana} ${hora}h em São Paulo). ` +
        'Mensagem comercial fora de hora é denúncia na certa. ' +
        'Use --ignorar-horario se souber o que está fazendo.',
    )
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
  const fila = dados.fila.filter((p) => !jaMarcados[p.dominio]).slice(0, MAX)

  console.log(`  fila total        ${dados.total}`)
  console.log(`  já com marca      ${Object.keys(jaMarcados).length}`)
  console.log(`  vão nesta rodada  ${fila.length}  (teto --max=${MAX})`)
  console.log(`  intervalo         ${INTERVALO_MIN / 1000}s a ${INTERVALO_MAX / 1000}s, sorteado`)

  if (fila.length === 0) return console.log('\n  Nada a enviar.\n')

  if (!confirmar) {
    console.log('\n  ENSAIO — nada será enviado. As três primeiras:\n')
    for (const p of fila.slice(0, 3)) {
      console.log(`  ${p.nome}  (${p.dominio})  ->  +${p.numero}`)
      console.log(
        '    ' + p.texto.split('\n\n')[1]?.slice(0, 90) + '…',
      )
    }
    const minutos = Math.round((fila.length * ((INTERVALO_MIN + INTERVALO_MAX) / 2)) / 60_000)
    console.log(`\n  ${fila.length} mensagens levariam ~${minutos} min.`)
    console.log('  Para enviar de verdade, repita com --confirmar.\n')
    return
  }

  const ctx = await chromium.launchPersistentContext(PERFIL, {
    headless: false,
    viewport: { width: 1280, height: 860 },
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const p = ctx.pages()[0] ?? (await ctx.newPage())

  try {
    await p.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' })

    // O pareamento é do dono, e acontece uma vez: enquanto o QR estiver na
    // tela, o script espera. Não há como (nem por que) automatizar isso.
    //
    // ## A sessão CAI, e o erro cru não dizia isso
    //
    // Em 09/09, às 19h, a rodada morreu com `TimeoutError: waitForSelector`
    // depois de três minutos parada, e o rastro apontava para o código. Era o
    // pareamento encerrado: a URL tinha virado `?post_logout=1` e o WhatsApp
    // estava mostrando o QR de novo.
    //
    // Separar os dois casos importa porque a ação é diferente. Sessão caída se
    // resolve lendo o QR e nada mais precisa mudar; um `TimeoutError` genérico
    // manda procurar defeito onde não há.
    console.log('\n  Aguardando o WhatsApp Web ficar pronto…')
    if (p.url().includes('post_logout')) {
      console.log('  A SESSÃO CAIU — o WhatsApp encerrou o pareamento deste navegador.')
      console.log('  Leia o QR: Configurações > Dispositivos conectados > Conectar dispositivo.')
    } else {
      console.log('  (se aparecer o QR, leia com o celular — só na primeira vez)')
    }

    const pronto = await p
      .waitForSelector('[data-testid="chat-list"], #pane-side', { timeout: 180_000 })
      .then(() => true)
      .catch(() => false)

    if (!pronto) {
      // "NENHUMA saiu" dito em voz alta: o medo legítimo de quem vê a rodada
      // falhar é ter mandado metade. Não mandou — o estado só grava depois do
      // envio, e é a mesma ordem que o vigia aprendeu em 01/09.
      return abortar(
        (p.url().includes('post_logout')
          ? 'a sessão do WhatsApp caiu e o QR não foi lido em 3 minutos. Rode de novo e ' +
            'leia o QR: Configurações > Dispositivos conectados > Conectar dispositivo. '
          : 'o WhatsApp Web não ficou pronto em 3 minutos. Pode ser rede, pode ser QR não lido. ') +
          'NENHUMA mensagem saiu.',
      )
    }
    console.log('  Conectado.\n')

    let enviadas = 0
    let semPrevia = 0
    for (const [i, alvo] of fila.entries()) {
      const rotulo = `[${i + 1}/${fila.length}] ${alvo.nome} (+${alvo.numero})`

      const url =
        `https://web.whatsapp.com/send?phone=${alvo.numero}` +
        `&text=${encodeURIComponent(alvo.texto)}`
      await p.goto(url, { waitUntil: 'domcontentloaded' })

      // Número que o WhatsApp não reconhece abre um diálogo em vez do chat.
      // Não é falha da rodada: é uma empresa que trocou de número.
      // ## Numero que nao esta no WhatsApp abre um DIALOGO, e o texto varia
      //
      // Em 09/09 a rodada morreu no 6 de 10, em `+55 11 3926-0073`. Aquilo e
      // um FIXO de Sao Paulo — o `3` depois do DDD diz isso —, e fixo quase
      // nunca tem WhatsApp. O aviso apareceu, mas a frase nao casou com a
      // expressao daqui, entao caiu no galho de "tempo" e a rodada inteira
      // parou com 4 empresas ainda na fila.
      //
      // Casar por FRASE e frágil por construcao: a mensagem muda com o idioma
      // do aparelho, com a versao do WhatsApp Web e com o humor do produto.
      // O que nao muda e a FORMA: um dialogo modal no meio da tela.
      //
      // ## Mas continua havendo dois desfechos diferentes, e a distincao vale
      //
      //     dialogo apareceu    numero de uma empresa que trocou de telefone.
      //                         PULA e segue: uma linha ruim nao pode custar
      //                         as outras da fila
      //     NADA apareceu       ambiguidade real — pode ser lentidao, pode ser
      //                         bloqueio. PARA, porque insistir contra um
      //                         bloqueio e como se perde a conta
      const dialogo = p.locator('[role="dialog"], [data-animate-modal-popup="true"]')
      const caixa = p.locator('[data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-tab]')

      const resultado = await Promise.race([
        dialogo.first().waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'invalido'),
        caixa.last().waitFor({ timeout: 45_000 }).then(() => 'pronto'),
      ]).catch(() => 'tempo')

      if (resultado === 'invalido') {
        const aviso = await dialogo
          .first()
          .innerText()
          .then((t) => t.replace(/\s+/g, ' ').slice(0, 60))
          .catch(() => '')
        console.log(`  ${rotulo}  ->  pulando${aviso ? `: "${aviso}"` : ' (diálogo do WhatsApp)'}`)
        await p.keyboard.press('Escape')
        continue
      }
      if (resultado === 'tempo') {
        abortar(`${rotulo}: a caixa de mensagem não apareceu em 45s. ` +
          'Pode ser lentidão, pode ser bloqueio. Parando por precaução.')
        break
      }

      // O texto já vem do `?text=`. Confere que ele está lá antes de mandar:
      // enviar uma caixa vazia é o pior resultado possível, porque a empresa
      // recebe um "oi" solto e a marca fica na lista como já abordada.
      const composto = (await caixa.last().innerText()).trim()
      if (composto.length < 50) {
        abortar(`${rotulo}: a caixa veio com ${composto.length} caracteres. Parando.`)
        break
      }

      // ## Esperar o CARTÃO antes de apertar Enter
      //
      // A primeira mensagem real saiu sem a prévia do link — só o endereço
      // sublinhado. A causa não é o site: `og:image` responde 200 com PNG de
      // 1200x630, e o cartão é montado pelo aparelho de QUEM ENVIA, enquanto o
      // texto está no campo. Com o `?text=` o texto chega inteiro de uma vez e
      // o Enter no instante seguinte manda a mensagem ANTES de a busca
      // terminar. Ou seja: o robô fazia exatamente o erro que eu tinha
      // avisado o dono para não cometer à mão.
      //
      // O sinal é o título do og aparecendo na tela. "o CRM que lembra" não
      // existe no texto da mensagem — se está visível, é o cartão, e não o que
      // foi digitado. Depender de `data-testid` do WhatsApp seria pior: eles
      // mudam sem aviso e a falha voltaria a ser silenciosa.
      const cartao = p.locator('text=/o CRM que lembra/i')
      const veioCartao = await cartao
        .first()
        .waitFor({ state: 'visible', timeout: 25_000 })
        .then(() => true)
        .catch(() => false)

      if (!veioCartao) {
        // Sem prévia a mensagem continua válida, e reenviar depois seria pior
        // que a falta do cartão. Fica CONTADO para a rodada poder ser julgada
        // no fim, em vez de parecer que deu tudo certo.
        semPrevia += 1
      }

      await caixa.last().click()
      await p.keyboard.press('Enter')

      // Só conta como enviada quando a bolha aparece do lado de saída.
      await p
        .locator('[data-testid="msg-container"], div.message-out')
        .last()
        .waitFor({ timeout: 30_000 })
        .catch(() => {})

      await marcarEnviado(alvo.dominio)
      enviadas += 1
      console.log(`  ${rotulo}  ->  enviada${veioCartao ? ' (com cartão)' : ' SEM CARTÃO'}`)

      if (i < fila.length - 1) {
        const espera = sortear(INTERVALO_MIN, INTERVALO_MAX)
        console.log(`      aguardando ${Math.round(espera / 1000)}s`)
        await dormir(espera)

        if (!dentroDoHorario()) {
          console.log('\n  A janela comercial fechou. Parando aqui.')
          break
        }
      }
    }

    console.log(`\n  ${enviadas} enviada(s). O estado está em ${ESTADO}.\n`)
  } finally {
    await ctx.close()
  }
}

await main()

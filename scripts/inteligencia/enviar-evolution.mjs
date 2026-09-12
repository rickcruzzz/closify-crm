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
 *     horario               9h as 16h de Sao Paulo, seg a SABADO. Domingo
 *                           nao. Mensagem comercial as 3h da manha e denuncia
 *                           na certa, e as 17h30 e lida no dia seguinte junto
 *                           com o acumulo. O porque de cada limite, e o que o
 *                           sabado a tarde custa, estao em `dentroDoHorario`
 *     --bloco=N             pausa longa a cada N mensagens. Cinco horas de
 *                           atividade sem um minuto de silencio e um padrao
 *                           que o intervalo sorteado nao quebra
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
 * Dois caminhos, e o de ARQUIVO é o preferido:
 *
 *     PROSPECCAO_IMAGEM_ARQUIVO   caminho no disco, mandado em base64
 *     PROSPECCAO_IMAGEM_URL       endereço público, a Evolution que baixa
 *
 * O arquivo ganha porque a peça nasce em `public/`, e `public/` só vira URL
 * pública **depois de um deploy**. Amarrar o disparo ao deploy significa que
 * trocar a arte pede uma promoção na Vercel — e a promoção aqui é manual. Com
 * base64 a arte gerada agora sai na mensagem seguinte.
 *
 * Medido antes de escolher: `sendMedia` com `media` em base64 devolve 201 com
 * `imageMessage`, igual à URL. Não é suposição.
 *
 * Os dois são **validados antes do primeiro envio** — o arquivo pela
 * assinatura dos bytes, a URL por HEAD e `content-type`, os dois pelo teto de
 * 5 MB. Sem nenhuma das variáveis, o disparo é só texto, que é o
 * comportamento seguro e não um erro.
 *
 * Imagem quebrada não é detalhe estético aqui: ela chega como quadrado cinza
 * no WhatsApp de uma empresa que nunca ouviu falar da gente, e é exatamente o
 * gatilho de "Bloquear e denunciar".
 */

import { readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, isAbsolute, basename } from 'node:path'

const RAIZ = process.cwd()
const ESTADO = join(RAIZ, '.dono-prospeccao.json')
const FILA = 'http://localhost:3000/dono/prospeccao/fila'
/**
 * Onde o envio vira registro no banco.
 *
 * `.dono-prospeccao.json` continua sendo a verdade do que ja saiu DESTA
 * maquina, e e ele que impede o reenvio. O que ele nao consegue ser e
 * alcancavel do lado de la: quem recebe a resposta e o webhook da Evolution,
 * que roda na Vercel, sem disco. Sem esta gravacao a resposta chega e o
 * sistema nao sabe de quem e — grava a conversa e perde o nicho, a pontuacao
 * e a mensagem que a provocou.
 *
 * Rota e nao escrita direta pelo mesmo motivo da `fila`: este arquivo e `.mjs`
 * e reescrever a regra aqui seria a segunda copia que diverge em silencio.
 */
const REGISTRO = 'http://localhost:3000/dono/prospeccao/enviado'

const EVOLUTION = process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const CHAVE = process.env.EVOLUTION_API_KEY
const INSTANCIA = process.env.EVOLUTION_INSTANCIA ?? 'VELO'
const IMAGEM = process.env.PROSPECCAO_IMAGEM_URL ?? null
/**
 * A arte escolhida pelo dono em 11/09: a comparação de preço.
 *
 * O padrão aponta para um arquivo em vez de ficar vazio porque a decisão já
 * foi tomada — deixar `null` faria o disparo sair só com texto até alguém
 * lembrar de exportar uma variável, e "esqueci de ligar a imagem" é
 * indistinguível de "escolhi não mandar" olhando o log.
 *
 * Foi escolhida contra quatro alternativas geradas no mesmo dia (dor, lacuna,
 * prova pelo print, risco) — a razão está no cabeçalho de
 * `scripts/marketing/gerar-peca-prospeccao.py`, que continua gerando as cinco.
 */
const IMAGEM_ARQUIVO =
  process.env.PROSPECCAO_IMAGEM_ARQUIVO ?? 'public/prospeccao/3-preco.png'

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const ignorarHorario = args.includes('--ignorar-horario')
const MAX = Number(args.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 30)
const SO = args.find((a) => a.startsWith('--so='))?.split('=')[1] ?? null
/** Manda so para os nichos que a regua de 07/09 aprovou. */
const SO_APROVADOS = args.includes('--so-aprovados')
/**
 * Grava no banco o que JA foi enviado antes de o registro existir, e sai.
 *
 * Os ~100 disparos anteriores a 12/09 marcaram estado so no JSON local. Sem
 * esta passada, uma resposta deles chegaria ao webhook sem prospect — a
 * conversa seria gravada e a atribuicao, perdida. Nao envia nada.
 */
const SINCRONIZAR = args.includes('--sincronizar')

const INTERVALO_MIN = 45_000
const INTERVALO_MAX = 150_000

/**
 * Quantas mensagens por bloco, antes da pausa longa. `0` desliga.
 *
 * Zero por padrão porque é o comportamento que já existia, e mudar o padrão
 * mudaria rodadas que alguém já sabe como se comportam. Quem quer blocos
 * pede: `--bloco=50`.
 */
const BLOCO = Number(args.find((a) => a.startsWith('--bloco='))?.split('=')[1] ?? 0)
/**
 * A pausa entre blocos, sorteada.
 *
 * 25 a 55 minutos é a faixa de um intervalo humano de verdade — café, um
 * cliente no balcão, almoço. Fixar em 40 exatos criaria um relógio, e relógio
 * é justamente o que a detecção procura.
 */
const PAUSA_MIN = 25 * 60_000
/**
 * 40 e nao 55: a janela encolheu para sete horas em 12/09, e com o teto
 * antigo o SORTEIO podia estourar. Medido para 200 em blocos de 50 — media
 * 7,0h e pior caso 7,4h, contra as 7h disponiveis. Uma rodada que depende de
 * sorte para caber nao cabe.
 */
const PAUSA_MAX = 40 * 60_000

/**
 * A janela de disparo, em hora de Sao Paulo. Decisao do dono em 12/09.
 *
 * ## Por que 16h e nao 18h
 *
 * Pedido dele, e e mais conservador do que estava. As duas ultimas horas do
 * expediente sao as piores para abordagem fria: quem esta fechando o dia nao
 * comeca conversa nova, e mensagem comercial as 17h30 e lida no dia seguinte
 * junto com o resto — ou seja, ela concorre com o acumulo em vez de chegar
 * sozinha.
 *
 * ## E o sabado usa a MESMA janela, com uma ressalva escrita
 *
 * Ela era 9h-13h no sabado, pelo argumento de que os cinco nichos fecham ao
 * meio-dia. O dono pediu 9h-16h para todos os dias, e isso vale — a decisao e
 * dele e o numero e dele.
 *
 * Fica registrado o que a mudanca custa, para a leitura do resultado nao
 * confundir as coisas: **sabado depois das 13h e mais fraco para ESTE ICP**.
 * Dedetizadora, marcenaria e comunicacao visual costumam fechar ao meio-dia,
 * entao mensagem das 14h em diante tende a ser lida so na segunda. Se a taxa
 * de resposta do sabado vier baixa, o horario e uma explicacao antes de a
 * mensagem ser culpada.
 */
const ABRE = 9
const FECHA = 16
/** Falhas seguidas que param a rodada. */
const FALHAS_SEGUIDAS_ATE_PARAR = 3
/** Teto do arquivo de imagem. Acima disso o WhatsApp recomprime e demora. */
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024

/**
 * Os nichos que a régua de 07/09 APROVOU, e os que ela reprovou.
 *
 * A régua foi escrita ANTES de olhar o resultado — `ORCAMENTO >= 2`,
 * `FORTE >= 4`, `CONTATO >= 6` — e derrubou duas escolhas que já estavam
 * tomadas. A tabela inteira está em
 * `docs/mercado/nichos-medidos-2026-09-06.md`.
 *
 * **Isto não filtra nada sozinho.** Só avisa quando a fila traz alguém que a
 * medição do próprio projeto reprovou, e o dono decide. Filtrar em silêncio
 * seria pior: a fila é dele, e uma rodada que encolhe sem explicar parece
 * defeito.
 *
 * O aviso existe porque a fila é ordenada por PONTOS, não por nicho — então
 * um nicho reprovado com pontuação alta lidera o disparo, e as primeiras
 * mensagens do dia saem para quem menos tem chance de responder.
 */
const NICHOS_APROVADOS = new Set([
  'dedetizacao',
  'comunicacao-visual',
  'marcenaria',
  'locacao-equipamentos',
  'eventos-corporativos',
])

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

/**
 * A janela comercial, e o SÁBADO entrou nela em 12/09.
 *
 * ## Por que a regra antiga estava errada para ESTE ICP
 *
 * Ela era `seg-sex, 9h-18h` — a janela de escritório, copiada sem pensar em
 * quem recebe. Os cinco nichos que a régua de 07/09 aprovou não são
 * escritório, e para todos os cinco o sábado de manhã é horário de trabalho
 * de verdade:
 *
 *     dedetizacao            sabado e quando casa e comercio ficam livres
 *                            para o servico acontecer
 *     comunicacao-visual     grafica rapida tem pico no sabado de manha
 *     marcenaria             abre sabado; e o dia em que o cliente vai medir
 *     locacao-equipamentos   entrega para obra que trabalha no sabado
 *     eventos-corporativos   o evento ACONTECE no fim de semana
 *
 * Tratar sábado como madrugada custava 20% das janelas de contato do mês,
 * contra um risco que não existe para este público: o que vira denúncia é
 * mensagem comercial em hora que a pessoa não está trabalhando, e às 10h de
 * sábado o dono da marcenaria está na marcenaria.
 *
 * **Domingo continua fora, e a distinção é a mesma**: nenhum dos cinco abre
 * domingo. E o sábado fecha às 13h, não às 18h — depois do almoço, os cinco
 * fecharam.
 *
 * A trava de madrugada não mudou em nada. 2h continua sendo 2h.
 */
function dentroDoHorario() {
  const { hora, diaDaSemana } = agoraEmSaoPaulo()
  if (/^dom/i.test(diaDaSemana)) return false
  return hora >= ABRE && hora < FECHA
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
 * O arquivo existe, cabe no teto, e é mesmo uma imagem?
 *
 * A conferência é pela ASSINATURA dos bytes, não pela extensão. Extensão é
 * texto que qualquer um escreve: um `.png` que na verdade é um HTML de erro
 * salvo por engano passaria no teste da extensão e chegaria como quadrado
 * cinza no WhatsApp de uma empresa que nunca ouviu falar da gente — que é
 * exatamente o gatilho de "Bloquear e denunciar" que este script inteiro
 * existe para evitar.
 *
 * Devolve o base64 junto: lido UMA vez e reusado nos 300 envios. Reler o
 * arquivo por mensagem seria I/O à toa, e reconverter também.
 */
async function conferirArquivo(caminho) {
  const abs = isAbsolute(caminho) ? caminho : join(RAIZ, caminho)
  if (!existsSync(abs)) return { erro: `não existe: ${caminho}` }
  const { size } = await stat(abs)
  if (size === 0) return { erro: 'arquivo vazio' }
  if (size > IMAGEM_MAX_BYTES) {
    return { erro: `${(size / 1e6).toFixed(1)} MB, acima do teto de 5 MB` }
  }
  const bytes = await readFile(abs)
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (!png && !jpeg) {
    return { erro: 'os primeiros bytes não são de PNG nem de JPEG' }
  }
  return {
    tipo: png ? 'image/png' : 'image/jpeg',
    bytes: size,
    base64: bytes.toString('base64'),
    nome: basename(abs),
  }
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

/**
 * O link que a mensagem carrega chega a algum lugar?
 *
 * Nasceu de um caso concreto, em 12/09: o link virou o atalho `/wa`, que é
 * declarado em `next.config.mjs` e **só existe em produção depois do deploy**
 * — e a promoção neste projeto é manual. Medido no dia: `/wa` devolvia 404 em
 * produção enquanto `/ig`, o atalho irmão, devolvia 307.
 *
 * Sem esta conferência, disparar antes de promover mandaria 837 empresas para
 * uma página de erro, com a mensagem prometendo um sistema. Nada falharia no
 * script: o WhatsApp entrega o texto, a Evolution devolve 201, e o estrago só
 * apareceria no silêncio de ninguém responder.
 *
 * Extraído do texto da PRÓPRIA mensagem, não escrito aqui: uma cópia do link
 * neste arquivo passaria a conferir um endereço que a mensagem não usa no dia
 * em que `abordagem.ts` mudasse — que é exatamente o dia em que a conferência
 * importa.
 *
 * `GET` e não `HEAD` porque é redirecionamento: alguns servidores respondem
 * diferente aos dois, e o que interessa é onde a pessoa de fato cai.
 */
async function conferirLink(texto) {
  const achado = texto.match(/https?:\/\/[^\s]+/)
  if (!achado) return { erro: 'a mensagem não tem link nenhum' }
  const url = achado[0]
  try {
    const r = await fetch(url, { redirect: 'follow' })
    if (!r.ok) return { url, erro: `HTTP ${r.status}` }
    return { url, destino: r.url }
  } catch (e) {
    return { url, erro: `não respondeu (${e.message})` }
  }
}

/**
 * Registra no banco que a abordagem saiu. Nunca derruba a rodada.
 *
 * Falhar aqui custa a ATRIBUICAO de uma mensagem; lancar custaria a rodada
 * inteira, com parte ja enviada. O aviso sai no console e o disparo segue —
 * `--sincronizar` recupera o que faltou depois.
 */
async function registrarEnvio(prospects) {
  try {
    const r = await fetch(REGISTRO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prospects }),
    })
    if (!r.ok) return { ok: false, erro: `HTTP ${r.status}` }
    return { ok: true, ...(await r.json()) }
  } catch (e) {
    return { ok: false, erro: e.message }
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
async function enviarUm(numero, texto, arte) {
  if (arte) {
    return evolution('/message/sendMedia', {
      number: numero,
      mediatype: 'image',
      ...(arte.base64
        ? { media: arte.base64, mimetype: arte.tipo, fileName: arte.nome }
        : { media: arte.url }),
      caption: texto,
    })
  }
  return evolution('/message/sendText', { number: numero, text: texto })
}

async function main() {
  console.log('')

  // A retaguarda nao toca a Evolution: ela le a fila local e grava no banco.
  // Por isso vem ANTES da checagem de credencial — ela funciona com a
  // instancia desconectada, que e justamente quando sobra tempo para rodar.
  if (SINCRONIZAR) {
    let todos
    try {
      const r = await fetch(`${FILA}?todos=1`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      todos = await r.json()
    } catch (e) {
      return abortar(`nao consegui ler ${FILA} (${e.message}). O \`npm run dev\` precisa estar de pe.`)
    }

    const marcados = await lerEstado()
    const jaSairam = todos.fila.filter((p) => {
      const estado = marcados[p.dominio]?.estado
      return estado === 'enviado' || estado === 'confirmado'
    })

    if (jaSairam.length === 0) {
      return console.log('\n  Nada para sincronizar: o estado local nao tem envio marcado.\n')
    }

    const corpo = jaSairam.map((p) => ({
      dominio: p.dominio,
      nome: p.nome,
      vertical: p.vertical,
      pontos: p.pontos,
      numero: p.numero,
      texto: p.texto,
      // A data que o JSON guardou, e nao agora: escrever `now()` aqui diria
      // que 100 empresas foram abordadas no instante da sincronizacao, e a
      // primeira pergunta que esta tabela responde e "quanto tempo levou ate
      // responder".
      enviadoEm: marcados[p.dominio]?.em ?? null,
    }))

    const r = await registrarEnvio(corpo)
    if (!r.ok) return abortar(`a sincronizacao falhou: ${r.erro}`)
    console.log(`\n  sincronizados ${r.gravados} de ${r.recebidos} (o resto ja tinha linha).\n`)
    return
  }

  if (!CHAVE) {
    return abortar(
      'falta EVOLUTION_API_KEY no .env.local. ' +
        'Ela é a AUTHENTICATION_API_KEY do serviço 8_evolution-api no EasyPanel.',
    )
  }

  // ## A trava de horário vale para o ENVIO, não para o ensaio — 12/09
  //
  // Ela abortava antes de tudo, e isso tornava impossível conferir a rodada
  // fora da janela: instância conectada, arte válida, link respondendo, fila
  // por nicho. Justamente o trabalho de véspera, que existe para o disparo da
  // manhã não começar com uma descoberta.
  //
  // O ensaio não envia nada — a trava ali não protegia de nada e custava a
  // preparação. Agora ele roda a qualquer hora e AVISA que a janela está
  // fechada; o `--confirmar` continua barrado exatamente como antes.
  const foraDaJanela = !dentroDoHorario() && !ignorarHorario
  if (foraDaJanela && confirmar) {
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
  if (SO_APROVADOS) fila = fila.filter((p) => NICHOS_APROVADOS.has(p.vertical))

  /**
   * ## Um NÚMERO só recebe uma vez, mesmo com dois domínios — 12/09
   *
   * Achado conferindo os 100 da primeira rodada grande: `i9 Acrílicos` e
   * `Fachadas Curitiba » i9 Comunicação Visual` são domínios diferentes com o
   * MESMO telefone. É a mesma empresa, com dois sites.
   *
   * Sem esta passada, a mesma pessoa receberia duas mensagens na mesma
   * rodada, cada uma a saudando por um nome de empresa diferente. Isso não é
   * só redundante: é a prova mais direta possível de que do outro lado tem um
   * robô, e "texto idêntico para centenas de destinos" é o terceiro padrão da
   * lista do que derruba número.
   *
   * A dedupe é por NÚMERO e não por domínio porque quem recebe é o número. O
   * estado em `.dono-prospeccao.json` continua sendo por domínio, e está
   * certo: ele responde "este site já foi abordado?", que é outra pergunta.
   *
   * Fica a PRIMEIRA, que é a de maior pontuação — a fila chega ordenada, e o
   * domínio descartado volta a aparecer numa rodada futura se o número sair
   * do `nao-perturbe`. Na fila inteira de nicho aprovado, 4 números de 628
   * caem aqui.
   */
  const vistos = new Set()
  const duplicados = []
  fila = fila.filter((p) => {
    if (vistos.has(p.numero)) {
      duplicados.push(p)
      return false
    }
    vistos.add(p.numero)
    return true
  })

  fila = fila.slice(0, MAX)

  // Quantas pausas longas a rodada vai ter. Declarado AQUI porque o resumo
  // logo abaixo ja o imprime, e o tempo total mais adiante o soma: sem isso a
  // estimativa diria 5,4h para uma rodada que leva 8, e a pessoa planejaria o
  // dia pelo numero errado.
  const pausas = BLOCO > 0 ? Math.floor((fila.length - 1) / BLOCO) : 0

  // Conta sobre a fila QUE VAI SAIR, não sobre a fila inteira: o que importa
  // é quantas das próximas `--max` mensagens vão para nicho reprovado.
  const reprovados = {}
  for (const p of fila) {
    if (!NICHOS_APROVADOS.has(p.vertical)) {
      reprovados[p.vertical] = (reprovados[p.vertical] ?? 0) + 1
    }
  }

  // O ARQUIVO vem primeiro: ele é a arte que está no disco agora, enquanto a
  // URL depende de um deploy ter acontecido. Quando as duas estão definidas,
  // a mais nova é sempre a do disco.
  let arte = null
  let imagemInfo = 'sem imagem (só texto)'
  if (IMAGEM_ARQUIVO) {
    const c = await conferirArquivo(IMAGEM_ARQUIVO)
    if (c.erro) {
      imagemInfo = `ARQUIVO RECUSADO: ${c.erro} — a rodada seguiria só com texto`
    } else {
      arte = c
      imagemInfo = `${IMAGEM_ARQUIVO} (${c.tipo}, ${(c.bytes / 1024).toFixed(0)} KB, base64)`
    }
  } else if (IMAGEM) {
    const c = await conferirImagem(IMAGEM)
    if (c.erro) {
      imagemInfo = `IMAGEM RECUSADA: ${c.erro} — a rodada seguiria só com texto`
    } else {
      arte = { url: IMAGEM, tipo: c.tipo, bytes: c.bytes }
      imagemInfo = `${c.tipo}, ${(c.bytes / 1024).toFixed(0)} KB (URL)`
    }
  }

  console.log(`  instância         ${INSTANCIA} (${conexao}), ${inst.owner ?? inst.number ?? '—'}`)
  console.log(`  fila total        ${dados.total}`)
  console.log(`  não perturbe      ${dados.naoPerturbe ?? 0}`)
  console.log(`  já com marca      ${Object.keys(jaMarcados).length}`)
  console.log(`  vão nesta rodada  ${fila.length}  (teto --max=${MAX})`)
  console.log(`  intervalo         ${INTERVALO_MIN / 1000}s a ${INTERVALO_MAX / 1000}s, sorteado`)
  if (BLOCO > 0) {
    console.log(
      `  blocos            ${BLOCO} por bloco, pausa de ` +
        `${PAUSA_MIN / 60_000}-${PAUSA_MAX / 60_000} min entre eles (${pausas} pausa(s))`,
    )
  }
  console.log(`  imagem            ${imagemInfo}`)
  if (duplicados.length > 0) {
    console.log(
      `  numero repetido   ${duplicados.length} empresa(s) fora: ` +
        duplicados.map((p) => p.nome.slice(0, 22)).join(', '),
    )
  }

  // Conferido sobre a PRIMEIRA mensagem da fila, e uma vez so: as 837
  // carregam o mesmo link, entao 837 requisicoes provariam o mesmo fato.
  if (fila.length > 0) {
    const link = await conferirLink(fila[0].texto)
    if (link.erro) {
      return abortar(
        `o link da mensagem esta quebrado: ${link.url ?? '(nenhum)'} devolveu ${link.erro}. ` +
          'Mandar a fila inteira para uma pagina de erro e pior que nao mandar. ' +
          'Se o link e um atalho novo (/wa, /ig), ele so existe em producao DEPOIS da promocao na Vercel.',
      )
    }
    console.log(`  link              ${link.url} -> ${link.destino}`)
  }

  const fora = Object.entries(reprovados)
  if (fora.length > 0) {
    const total = fora.reduce((soma, [, q]) => soma + q, 0)
    console.log('')
    console.log(`  ATENCAO: ${total} de ${fila.length} vao para nicho que a regua REPROVOU`)
    for (const [nicho, q] of fora.sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(q).padStart(4)}  ${nicho}`)
    }
    console.log('    docs/mercado/nichos-medidos-2026-09-06.md tem a tabela')
    console.log('    use --so-aprovados para mandar so para os cinco aprovados')
  }

  if (fila.length === 0) return console.log('\n  Nada a enviar.\n')

  const minutos = Math.round(
    (fila.length * ((INTERVALO_MIN + INTERVALO_MAX) / 2) +
      pausas * ((PAUSA_MIN + PAUSA_MAX) / 2)) /
      60_000,
  )

  if (!confirmar) {
    if (foraDaJanela) {
      const { hora, diaDaSemana } = agoraEmSaoPaulo()
      console.log(
        `
  JANELA FECHADA (${diaDaSemana} ${hora}h em São Paulo). ` +
          'O ensaio roda; o envio, não.',
      )
    }
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

    const r = await enviarUm(p.numero, p.texto, arte)

    if (r.ok) {
      await marcarEnviado(p.dominio, { via: 'evolution', comImagem: Boolean(arte) })
      // Depois do arquivo, nunca antes: o arquivo e o que impede o reenvio, e
      // ele precisa estar gravado mesmo que o banco esteja fora do ar.
      const registro = await registrarEnvio([
        {
          dominio: p.dominio,
          nome: p.nome,
          vertical: p.vertical,
          pontos: p.pontos,
          numero: p.numero,
          texto: p.texto,
        },
      ])
      if (!registro.ok) {
        console.error(`       (nao registrei ${p.dominio} no banco: ${registro.erro} — rode --sincronizar depois)`)
      }
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

    if (i >= fila.length - 1) continue

    /**
     * ## A pausa longa entre BLOCOS — 12/09
     *
     * Pedido do dono ao subir para 200/dia: dividir em blocos pequenos ao
     * longo do dia em vez de uma fita corrida de cinco horas.
     *
     * O intervalo sorteado de 45-150s já quebra a cadência fixa, que é a
     * assinatura mais óbvia. O que ele NÃO quebra é o outro padrão: cinco
     * horas de atividade ininterrupta, sem um minuto de silêncio. Pessoa
     * nenhuma manda mensagem a cada dois minutos por cinco horas seguidas —
     * ela atende um cliente, almoça, some.
     *
     * A pausa também é sorteada, pela mesma razão que o intervalo é: 40
     * minutos exatos entre blocos é um relógio, e relógio é o que se detecta.
     *
     * **`Ctrl+C` durante a pausa não perde nada**, como em qualquer outro
     * ponto: o estado foi gravado antes de dormir.
     */
    const fimDeBloco = BLOCO > 0 && (i + 1) % BLOCO === 0
    if (fimDeBloco) {
      const pausa = sortear(PAUSA_MIN, PAUSA_MAX)
      const volta = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        timeStyle: 'short',
      }).format(new Date(Date.now() + pausa))
      console.log(
        `\n  bloco de ${BLOCO} fechado (${i + 1}/${fila.length}). ` +
          `Pausa de ${Math.round(pausa / 60_000)} min, volta ~${volta}.\n`,
      )
      await dormir(pausa)
      continue
    }

    await dormir(sortear(INTERVALO_MIN, INTERVALO_MAX))
  }

  const duracao = Math.round((Date.now() - comecou) / 60_000)
  console.log(`\n  enviados ${enviados} | sem WhatsApp ${pulados} | ${duracao} min`)
  console.log(`  o estado está em ${ESTADO} — rodar de novo continua de onde parou.\n`)
}

main().catch((e) => abortar(`falha inesperada: ${e.message}`))

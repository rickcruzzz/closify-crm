import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  detectarInjecao,
  enveloparMensagem,
  validarResposta,
} from '@/lib/sdr/blindagem'
import {
  instrucoesDoAgente,
  limparResposta,
  pediuPassagem,
} from '@/lib/sdr/instrucoes'
import {
  cabeNoTeto,
  descreverImagem,
  ehAudioLongoDemais,
  FALHA_DE_MIDIA,
  montarPromptDeAudio,
  montarPromptDeImagem,
  transcreverAudio,
} from '@/lib/sdr/midia'
import {
  humanoAssumiu,
  mensagensPendentes,
  montarHistorico,
  temMensagemDoCliente,
  type MensagemCrua,
} from '@/lib/sdr/conversa'

export const runtime = 'nodejs'

/**
 * O agente SDR, exposto para o n8n.
 *
 * ## Por que o cérebro fica AQUI e não no n8n
 *
 * O reflexo é colar o prompt num nó de "AI Agent" do n8n e pronto. Isso cria
 * uma segunda cópia do preço, dos limites e da lista do que o produto não faz —
 * e cópia que diverge em silêncio é a classe de defeito mais cara deste
 * projeto. Já custou: `price: 'R$49'` escrito à mão ao lado da linha que lia a
 * constante; a arte anunciando trial aposentado dois dias antes; a bio do
 * Instagram com limite de 300 contatos meses depois de virar 50.
 *
 * Um prompt no n8n seria a pior das três, porque ninguém revisa JSON de
 * workflow ao mudar preço — e o agente que erra o preço erra numa conversa de
 * venda, com o cliente lendo.
 *
 * Aqui, `instrucoesDoAgente()` deriva tudo de `lib/plans.ts` em tempo de
 * chamada. Trocar `PRO_PLAN_PRICE` atualiza o agente sem tocar no n8n.
 *
 * **O n8n orquestra: recebe do WhatsApp, chama esta rota, devolve a resposta e
 * avisa o dono. Ele não decide o que dizer.**
 *
 * ## O gate é segredo compartilhado, não sessão
 *
 * Quem chama é um servidor (a VPS), não uma pessoa logada. Mesmo padrão do
 * `CRON_SECRET` que já protege as rotas de cron: cabeçalho com segredo, e 401
 * sem ele. Sem gate, esta rota seria um proxy de OpenAI aberto na internet —
 * qualquer um gastaria a chave do dono.
 */

const entrada = z.object({
  /** O que a pessoa escreveu agora. */
  /**
   * O que a pessoa escreveu agora.
   *
   * Aceita vazio porque áudio e imagem chegam SEM texto: o WhatsApp não manda
   * legenda em áudio, e imagem sem legenda é comum. O conteúdo, nesse caso,
   * nasce de `midia` logo abaixo.
   */
  mensagem: z.string().trim().max(4000),
  /** Nome da empresa, quando a prospecção sabe. */
  empresa: z.string().trim().max(120).optional().nullable(),
  /** Nicho, para o agente falar a língua certa. */
  vertical: z.string().trim().max(60).optional().nullable(),
  /** O bloco já montado por `lib/sdr/enriquecer.ts`. Opcional. */
  pesquisa: z.string().trim().max(4000).optional().nullable(),
  /**
   * A conversa até agora, do mais antigo ao mais novo.
   *
   * Teto de 20 turnos: o suficiente para o agente lembrar o que foi dito, e
   * curto o bastante para uma conversa longa não virar prompt de dez mil
   * tokens a cada mensagem nova.
   */
  historico: z
    .array(z.object({ de: z.enum(['cliente', 'agente']), texto: z.string().max(4000) }))
    .max(20)
    .optional(),
  /**
   * A conversa CRUA, como a Evolution devolve em `/chat/findMessages`.
   *
   * Quando vem, ela substitui `historico` e `mensagem`: o servidor monta os
   * dois a partir daqui, e decide sozinho se um humano assumiu. É a diferença
   * entre o n8n orquestrar e o n8n decidir — e decidir em JSON de workflow é
   * o que nenhum teste alcança.
   *
   * Continua opcional: o caminho antigo (só `mensagem`) segue valendo, e é o
   * que roda enquanto o fluxo novo não é publicado.
   */
  conversa: z.array(z.unknown()).max(200).optional(),
  /**
   * Áudio ou imagem que a pessoa mandou, em base64.
   *
   * O n8n baixa da Evolution (`getBase64FromMediaMessage`) e repassa. Fica
   * assim, e não com `webhookBase64: true` na instância, porque aquilo embutiria
   * o base64 de TODA mídia em TODO webhook — um áudio de um minuto vira ~1 MB
   * de JSON mesmo quando o agente vai ignorar a mensagem.
   */
  midia: z
    .object({
      tipo: z.enum(['audio', 'imagem']),
      base64: z.string().min(1),
      /** Duração do áudio, quando o WhatsApp informa. */
      segundos: z.number().int().nonnegative().optional().nullable(),
      /** Legenda da imagem — quase sempre é a pergunta de verdade. */
      legenda: z.string().max(1000).optional().nullable(),
    })
    .optional(),
})

const MODELO = 'gpt-4.1'

export async function POST(req: Request) {
  const segredo = process.env.SDR_WEBHOOK_SECRET
  if (!segredo) {
    // Falha fechada. Sem o segredo configurado, a rota não responde — o
    // contrário deixaria a chave da OpenAI aberta enquanto alguém "ainda não
    // configurou".
    return NextResponse.json({ error: 'agente não configurado' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const chave = process.env.OPENAI_API_KEY
  if (!chave) {
    return NextResponse.json({ error: 'OPENAI_API_KEY ausente' }, { status: 503 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  const lido = entrada.safeParse(corpo)
  if (!lido.success) {
    return NextResponse.json(
      { error: lido.error.issues[0]?.message ?? 'dados inválidos' },
      { status: 400 },
    )
  }

  const { mensagem, empresa, vertical, pesquisa, historico, conversa, midia } = lido.data

  // ## A pausa quando o atendente entra
  //
  // O fluxo avisava o dono E respondia ao cliente na mesma passagem, e na
  // mensagem seguinte respondia de novo — nada guardava que um humano tinha
  // entrado. O cliente ficava conversando com duas pessoas ao mesmo tempo.
  //
  // Decidido AQUI e não no n8n: `saiuPelaApi` distingue o agente do atendente
  // por duas evidências combinadas, tem 17 testes, e um `if` de workflow não
  // tem nenhum.
  const cruas = (conversa ?? []) as MensagemCrua[]
  // ## A conversa só vale quando ela de fato contém a conversa
  //
  // A Evolution desta instalação não persiste mensagem RECEBIDA: `findMessages`
  // devolve só o que ela enviou. Medido em produção em 11/09 — três áudios
  // chegaram, três execuções deram `success`, e nada foi respondido.
  //
  // Sem isto, o histórico vazio fazia o buffer parecer vazio e a rota calava.
  // Com isto, o agente cai no caminho antigo: sem memória, mas respondendo.
  const historicoUtil = temMensagemDoCliente(cruas)
  if (historicoUtil && humanoAssumiu(cruas)) {
    return NextResponse.json({
      texto: '',
      calar: true,
      motivo: 'um atendente humano já está nesta conversa',
    })
  }

  // Tudo que chegou depois da última resposta nossa, junto. Sem isto, quem
  // escreve "oi" / "quanto custa?" / "pra 3 pessoas" recebe TRÊS respostas, e
  // a primeira sai sem saber que existiam as outras duas.
  const doBuffer = historicoUtil ? mensagensPendentes(cruas) : ''

  // Buffer vazio com conversa presente quer dizer que a ÚLTIMA palavra já foi
  // nossa: outra execução respondeu enquanto esta esperava. Calar aqui é a
  // segunda metade da trava contra resposta dobrada — a primeira é o fluxo
  // conferir se a última mensagem do cliente mudou durante a espera.
  if (historicoUtil && !doBuffer) {
    return NextResponse.json({ texto: '', calar: true, motivo: 'nada novo para responder' })
  }

  let paraResponder = doBuffer || mensagem

  // ## Áudio e imagem viram TEXTO aqui, antes de o agente ver
  //
  // Até 11/09 os dois caíam no ramo `Ignora` do fluxo e o agente não respondia
  // nada. Silêncio, para quem mandou, lê como "não funciona" — pior que uma
  // resposta ruim. E não é caso raro: marcenaria, vidraçaria e dedetizadora
  // mandam áudio o tempo todo, porque é como se escreve na obra.
  //
  // O resultado entra em `paraResponder`, ou seja, passa pelo MESMO envelope e
  // pela MESMA blindagem da mensagem de texto. Sem isso a imagem seria um canal
  // que contorna a trava: bastaria escrever a injeção num print.
  if (midia) {
    if (!cabeNoTeto(midia.base64)) {
      return NextResponse.json({ texto: FALHA_DE_MIDIA[midia.tipo], passar: true, motivo: 'mídia grande demais' })
    }

    if (midia.tipo === 'audio') {
      // Áudio longo não é pergunta, é desabafo ou briefing — e a resposta
      // honesta para os dois é um humano. O custo por minuto do Whisper é o
      // segundo motivo, não o primeiro.
      if (ehAudioLongoDemais(midia.segundos)) {
        return NextResponse.json({ texto: FALHA_DE_MIDIA.audioLongo, passar: true, motivo: 'áudio longo' })
      }
      const t = await transcreverAudio(midia.base64, chave)
      if ('erro' in t) {
        return NextResponse.json({ texto: FALHA_DE_MIDIA.audio, passar: true, motivo: t.erro })
      }
      paraResponder = montarPromptDeAudio(t.texto)
    } else {
      const d = await descreverImagem(midia.base64, chave)
      if ('erro' in d) {
        return NextResponse.json({ texto: FALHA_DE_MIDIA.imagem, passar: true, motivo: d.erro })
      }
      paraResponder = montarPromptDeImagem(d.texto, midia.legenda)
    }
  }

  // O histórico derivado da conversa vence o que veio pronto: ele é o que de
  // fato aconteceu no WhatsApp, e não o que o fluxo achou que aconteceu.
  const turnos =
    historicoUtil
      ? // A última rodada do cliente já vai em `paraResponder`; repeti-la no
        // histórico faria o modelo ler a mesma pergunta duas vezes.
        montarHistorico(cruas).filter((t) => !(t.de === 'cliente' && paraResponder.includes(t.texto)))
      : (historico ?? [])

  // `mensagem` deixou de ser obrigatória para caber áudio e imagem, então o
  // vazio precisa ser barrado AQUI em vez de no schema. Sem esta guarda um
  // corpo `{ mensagem: "" }` chegaria ao modelo como envelope vazio, e ele
  // responderia a nada — que é o tipo de resposta que some com a conversa.
  if (!paraResponder.trim()) {
    return NextResponse.json({ error: 'nada para responder' }, { status: 400 })
  }

  const mensagens = [
    {
      role: 'system' as const,
      // `primeiraMensagem` é o que o modelo não consegue inferir: histórico
      // vazio é ambíguo entre "primeira mensagem" e "não temos o histórico", e
      // os dois pedem o oposto. Aqui sabemos qual é.
      content: instrucoesDoAgente({
        empresa,
        vertical,
        pesquisa,
        primeiraMensagem: turnos.length === 0,
      }),
    },
    ...turnos.map((h) => ({
      role: h.de === 'cliente' ? ('user' as const) : ('assistant' as const),
      content: h.texto,
    })),
    // Envelopada: o que o cliente escreveu e DADO, nunca instrucao.
    { role: 'user' as const, content: enveloparMensagem(paraResponder) },
  ]

  // A deteccao nao BARRA — ela marca. Quem tenta injecao merece um humano,
  // nao uma negativa automatica, e o dono precisa saber que aconteceu.
  const injecao = detectarInjecao(paraResponder)

  let resposta: Response
  try {
    resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: mensagens,
        // Curto de propósito. É WhatsApp: resposta longa não é lida, e o teto
        // é mais confiável que pedir brevidade no prompt.
        max_tokens: 300,
        // 0.7 e não 0: o agente precisa soar como gente. Determinístico demais
        // produz a mesma frase para todo mundo, que é o que denuncia robô.
        temperature: 0.7,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'falha ao falar com a OpenAI' }, { status: 502 })
  }

  if (!resposta.ok) {
    return NextResponse.json(
      { error: `openai ${resposta.status}` },
      { status: resposta.status === 429 ? 429 : 502 },
    )
  }

  const dados = (await resposta.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const bruta = dados.choices?.[0]?.message?.content?.trim() ?? ''

  if (!bruta) {
    // Resposta vazia é pior que erro: o n8n mandaria uma mensagem em branco
    // para o cliente. Vira passagem para o dono.
    return NextResponse.json({ texto: '', passar: true, motivo: 'resposta vazia' })
  }

  // A ultima porta. Nao importa como a pessoa formulou o ataque: se a resposta
  // promete desconto, cita preco que nao e o nosso ou repete o prompt, ela nao
  // sai — vira passagem para o atendente.
  const veredito = validarResposta(limparResposta(bruta))

  if (!veredito.ok) {
    return NextResponse.json({
      texto: 'Vou chamar um atendente pra te responder isso.',
      passar: true,
      motivo: veredito.motivo,
      modelo: MODELO,
    })
  }

  return NextResponse.json({
    texto: veredito.texto,
    passar: pediuPassagem(bruta) || injecao.suspeito,
    ...(injecao.suspeito ? { motivo: `entrada suspeita: ${injecao.motivos.join(', ')}` } : {}),
    modelo: MODELO,
  })
}

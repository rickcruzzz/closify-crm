import type { Intencao, Objecao, Temperatura } from '@/lib/prospeccao/classificacao'

/**
 * O que a prospecção aprendeu, agregado — e o que ela ainda NÃO pode dizer.
 *
 * ## Por que este arquivo é puro
 *
 * Sem `server-only` e sem I/O, o mesmo desenho de `ativacao.ts` e
 * `atribuicao.ts`. A parte difícil aqui não é ler o banco: é **se recusar a
 * responder** quando a amostra não sustenta a resposta. Essa regra erra em
 * silêncio — produz um número plausível — e por isso precisa de teste.
 *
 * ## A regra que governa tudo: contagem sempre, TAXA quase nunca
 *
 * O pedido foi explícito: *"não alterar automaticamente o sistema inteiro com
 * base em amostras pequenas. Definir amostra mínima antes de declarar
 * vencedor."*
 *
 * A conta que fixa o número: cold outreach responde entre 3,8% e 7,2%. Com 30
 * abordagens num nicho, o esperado é **uma ou duas respostas** — e a diferença
 * entre 1 e 2 vira uma "taxa" de 3,3% contra 6,7%, o dobro, por puro acaso.
 * Declarar vencedor ali é ler ruído.
 *
 * Por isso: **as contagens aparecem sempre** (elas são fato), e a taxa só
 * aparece acima de 100 abordagens no segmento. Abaixo disso a tela diz quantas
 * faltam, em vez de mostrar um número que parece medição.
 *
 * Este projeto já pagou caro pelo contrário: em 29/08 uma classificação feita
 * à mão produziu *"6 de 9 clientes abandonaram"*, e o número plausível foi
 * repetido em quatro documentos antes de alguém conferir.
 */

/**
 * Abordagens num segmento antes de a taxa de resposta valer alguma coisa.
 *
 * Cem, e não trinta: a 3,8-7,2% do setor, cem abordagens dão de 4 a 7
 * respostas — faixa estreita o bastante para uma diferença entre nichos
 * significar algo. Com trinta, o intervalo de confiança cobre o dobro e a
 * metade do valor observado.
 */
export const MINIMO_PARA_TAXA = 100

/**
 * Respostas antes de comparar o que acontece DEPOIS delas (objeção, interesse).
 *
 * Cinco é o mesmo piso que `maiorVazamento` já usa em `ativacao.ts`, pela
 * mesma razão: abaixo disso uma única conversa move o ranking inteiro.
 */
export const MINIMO_PARA_COMPARAR = 5

export type ProspectObservado = {
  dominio: string
  vertical: string | null
  pontos: number | null
  estagio: string
  intencao: Intencao | null
  objecao: Objecao | null
  temperatura: Temperatura | null
  enviadoEm: string | null
  respondidoEm: string | null
  mensagensRecebidas: number
  precisaHumano: boolean
  /** A mensagem exata que saiu. O gancho é a segunda linha dela. */
  mensagemEnviada: string | null
}

export type InteracaoObservada = {
  intencao: Intencao
  objecao: Objecao | null
  temperatura: Temperatura
  confianca: number | null
  precisaHumano: boolean
}

/** Um degrau do funil. `taxa` é sobre o degrau ANTERIOR, não sobre o topo. */
export type DegrauDaProspeccao = {
  rotulo: string
  quantidade: number
  /** `null` quando o degrau anterior é zero — não existe taxa sobre nada. */
  taxa: number | null
  explicacao: string
}

const ESTAGIOS_QUE_RESPONDERAM = new Set([
  'REPLIED',
  'QUALIFYING',
  'INTERESTED',
  'OBJECTION',
  'CONSIDERING',
  'LOST',
  'OPTED_OUT',
  'HUMAN_HANDOFF',
])

const ESTAGIOS_DE_INTERESSE = new Set(['QUALIFYING', 'INTERESTED'])

function taxaSobre(quantidade: number, anterior: number): number | null {
  return anterior > 0 ? quantidade / anterior : null
}

/**
 * O funil da prospecção, do universo descoberto até quem demonstrou interesse.
 *
 * ## Ele PARA em "interessados", e a ausência dos dois últimos degraus é a
 * informação mais importante desta tela
 *
 * O desenho pedido ia até *pagaram*. Ele não vai, porque **não existe ligação
 * entre prospect e cliente pagante** — é o achado ALTO nº 4 da auditoria de
 * 12/09, e continua aberto. O webhook grava `workspace_id` apontando para a
 * empresa da prospecção, que é onde o contato mora, não para uma conta que
 * alguém criou depois.
 *
 * Desenhar `Checkout: 0` e `Pagaram: 0` seria pior que omitir: a leitura
 * natural é *"ninguém chega lá"*, quando a verdade é *"não há como saber"*. As
 * duas pedem ações opostas — a primeira manda mexer na conversa, a segunda
 * manda construir a atribuição.
 */
export function montarFunilDaProspeccao(entrada: {
  descobertos: number
  prospects: ProspectObservado[]
}): DegrauDaProspeccao[] {
  const abordados = entrada.prospects.filter((p) => p.enviadoEm).length
  const responderam = entrada.prospects.filter(
    (p) => p.respondidoEm || ESTAGIOS_QUE_RESPONDERAM.has(p.estagio),
  ).length
  const conversando = entrada.prospects.filter((p) => p.mensagensRecebidas > 1).length
  const interessados = entrada.prospects.filter((p) => ESTAGIOS_DE_INTERESSE.has(p.estagio)).length

  return [
    {
      rotulo: 'Descobertos',
      quantidade: entrada.descobertos,
      taxa: null,
      explicacao: 'o universo em CSV mais os leads gravados',
    },
    {
      rotulo: 'Abordados',
      quantidade: abordados,
      taxa: taxaSobre(abordados, entrada.descobertos),
      explicacao: 'a mensagem saiu de verdade',
    },
    {
      rotulo: 'Responderam',
      quantidade: responderam,
      taxa: taxaSobre(responderam, abordados),
      explicacao: 'qualquer resposta, inclusive "não quero"',
    },
    {
      rotulo: 'Conversando',
      quantidade: conversando,
      taxa: taxaSobre(conversando, responderam),
      explicacao: 'mandou mais de uma mensagem',
    },
    {
      rotulo: 'Interessados',
      quantidade: interessados,
      taxa: taxaSobre(interessados, responderam),
      explicacao: 'perguntou preço, pediu detalhe ou demo',
    },
  ]
}

export type LinhaDeObjecao = {
  objecao: Objecao
  quantidade: number
  /** Fatia das respostas que trouxeram alguma objeção. */
  fatia: number
}

/**
 * As objeções, da mais comum para a mais rara.
 *
 * A fatia é sobre as respostas COM objeção, não sobre todas: a pergunta que
 * essa tela responde é *"quando aparece barreira, qual é?"*. Dividir pelo
 * total faria toda objeção parecer rara num mês em que a maioria só perguntou
 * preço.
 */
export function rankingDeObjecoes(interacoes: InteracaoObservada[]): LinhaDeObjecao[] {
  const contagem = new Map<Objecao, number>()
  for (const i of interacoes) {
    if (!i.objecao) continue
    contagem.set(i.objecao, (contagem.get(i.objecao) ?? 0) + 1)
  }
  // `Array.from` e nao spread: o `target` do tsconfig e ES5 para Map, e
  // `[...map.entries()]` exige `downlevelIteration`. Ligar a flag para uma
  // linha mudaria a compilacao do projeto inteiro.
  const total = Array.from(contagem.values()).reduce((s, n) => s + n, 0)
  return Array.from(contagem.entries())
    .map(([objecao, quantidade]) => ({ objecao, quantidade, fatia: quantidade / total }))
    .sort((a, b) => b.quantidade - a.quantidade)
}

export type LinhaDeSegmento = {
  rotulo: string
  abordados: number
  responderam: number
  interessados: number
  /** `null` até a amostra chegar a `MINIMO_PARA_TAXA`. Ver o topo do arquivo. */
  taxaDeResposta: number | null
  /** Quantas abordagens faltam para a taxa aparecer. Zero quando já apareceu. */
  faltamParaMedir: number
}

function montarSegmento(rotulo: string, prospects: ProspectObservado[]): LinhaDeSegmento {
  const abordados = prospects.filter((p) => p.enviadoEm).length
  const responderam = prospects.filter(
    (p) => p.respondidoEm || ESTAGIOS_QUE_RESPONDERAM.has(p.estagio),
  ).length
  const interessados = prospects.filter((p) => ESTAGIOS_DE_INTERESSE.has(p.estagio)).length

  const temAmostra = abordados >= MINIMO_PARA_TAXA
  return {
    rotulo,
    abordados,
    responderam,
    interessados,
    taxaDeResposta: temAmostra ? responderam / abordados : null,
    faltamParaMedir: temAmostra ? 0 : MINIMO_PARA_TAXA - abordados,
  }
}

/**
 * Nicho a nicho. Ordenado por ABORDADOS, não por taxa.
 *
 * Ordenar por taxa poria no topo o nicho com 1 abordagem e 1 resposta — 100%,
 * e nada. A tela existe para orientar para onde mandar as próximas mensagens, e
 * a ordem por volume é a que mostra onde a medição já tem chão.
 */
export function rankingDeNichos(prospects: ProspectObservado[]): LinhaDeSegmento[] {
  const porNicho = new Map<string, ProspectObservado[]>()
  for (const p of prospects) {
    const chave = p.vertical ?? 'sem-nicho'
    const lista = porNicho.get(chave) ?? []
    lista.push(p)
    porNicho.set(chave, lista)
  }
  return Array.from(porNicho.entries())
    .map(([nicho, lista]) => montarSegmento(nicho, lista))
    .sort((a, b) => b.abordados - a.abordados)
}

/**
 * O gancho é a SEGUNDA linha da mensagem que saiu.
 *
 * Extraído do texto gravado, e não recalculado por `montarAbordagem`: o gancho
 * é determinístico pelo domínio HOJE, e deixa de ser reconstruível no dia em
 * que `abordagem.ts` mudar uma palavra. O que foi enviado é o que está escrito.
 */
export function ganchoDa(mensagem: string | null): string | null {
  if (!mensagem) return null
  const linhas = mensagem.split('\n').filter((l) => l.trim())
  return linhas[1]?.trim() ?? null
}

/** Qual gancho traz resposta. Mesmo piso de amostra dos nichos. */
export function rankingDeGanchos(prospects: ProspectObservado[]): LinhaDeSegmento[] {
  const porGancho = new Map<string, ProspectObservado[]>()
  for (const p of prospects) {
    const gancho = ganchoDa(p.mensagemEnviada)
    if (!gancho) continue
    const lista = porGancho.get(gancho) ?? []
    lista.push(p)
    porGancho.set(gancho, lista)
  }
  return Array.from(porGancho.entries())
    .map(([gancho, lista]) => montarSegmento(gancho, lista))
    .sort((a, b) => b.abordados - a.abordados)
}

export type FaixaDePontos = LinhaDeSegmento & { de: number; ate: number }

/**
 * O score prevê resposta?
 *
 * É a pergunta que o score nunca conseguiu responder: ele foi escrito em 06/09
 * com pesos decididos por raciocínio, e desde então ordena a fila sem ninguém
 * saber se acerta. Estas faixas são o instrumento — e continuarão vazias de
 * conclusão até cada faixa ter suas cem abordagens.
 *
 * **Nada aqui muda o score automaticamente**, e isso é ordem: *"só depois de
 * possuir dados suficientes propor alteração dos pesos"*.
 */
export function porFaixaDePontos(prospects: ProspectObservado[]): FaixaDePontos[] {
  const faixas: { de: number; ate: number }[] = [
    { de: 0, ate: 9 },
    { de: 10, ate: 11 },
    { de: 12, ate: 13 },
    { de: 14, ate: 99 },
  ]
  return faixas.map((f) => {
    const dentro = prospects.filter((p) => (p.pontos ?? 0) >= f.de && (p.pontos ?? 0) <= f.ate)
    return { ...montarSegmento(`${f.de}–${f.ate === 99 ? '+' : f.ate}`, dentro), ...f }
  })
}

export type Temperaturas = Record<Temperatura, number>

/** Quantos estão em cada temperatura. É a fila do dia, ordenada pelo mais quente. */
export function contarTemperaturas(prospects: ProspectObservado[]): Temperaturas {
  const zerado: Temperaturas = {
    frio: 0,
    morno: 0,
    quente: 0,
    muito_quente: 0,
    fechamento: 0,
  }
  for (const p of prospects) {
    if (p.temperatura) zerado[p.temperatura] += 1
  }
  return zerado
}

/**
 * O tempo entre a abordagem e a resposta, em horas.
 *
 * Mediana e não média: uma resposta que chega duas semanas depois puxa a média
 * para um número que não descreve ninguém. A mediana responde *"em quanto
 * tempo metade respondeu"*, que é o que decide quando parar de esperar.
 */
export function medianaDeResposta(prospects: ProspectObservado[]): number | null {
  const horas = prospects
    .filter((p) => p.enviadoEm && p.respondidoEm)
    .map((p) => (Date.parse(p.respondidoEm!) - Date.parse(p.enviadoEm!)) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b)

  if (horas.length === 0) return null
  const meio = Math.floor(horas.length / 2)
  return horas.length % 2 === 0 ? (horas[meio - 1] + horas[meio]) / 2 : horas[meio]
}

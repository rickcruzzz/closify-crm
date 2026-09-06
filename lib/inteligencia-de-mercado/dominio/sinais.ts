/**
 * Classifica um trecho devolvido pelo Exa em sinal de compra, ou descarta.
 *
 * ## Por que classificar antes de mostrar
 *
 * O Exa devolve texto; texto sempre parece insight. Sem uma régua, qualquer
 * página institucional vira "dor identificada" e o recurso passa a produzir
 * afirmação plausível sobre coisa nenhuma — a classe de erro mais cara deste
 * repositório.
 *
 * A régua aqui é deliberadamente burra e explícita: expressão que aparece no
 * texto, sem modelo de linguagem no meio. Burro é auditável; quando errar, dá
 * para apontar a linha.
 *
 * ## A armadilha CIRCULAR, achada na primeira prova contra a API real
 *
 * A consulta pergunta "quais são os gargalos?". O Exa devolve o trecho que
 * contém "gargalo" — é o trabalho dele. O classificador então lê "gargalo" e
 * declara `dor/alta`.
 *
 * **O sinal era a própria pergunta ecoando de volta.** Medido em 06/09/2026
 * contra `rdstation.com`: 6 trechos do blog institucional viraram 5 sinais de
 * dor alta, todos por essa via. Conteúdo que a empresa escreveu sobre a dor DOS
 * CLIENTES DELA passava como dor dela.
 *
 * Por isso `classificarSinal` recebe os termos da consulta e os **desqualifica
 * como evidência**. Palavra que eu pus na pergunta não pode ser prova.
 */

export type TipoDeSinal = 'dor' | 'contratacao' | 'investimento' | 'reclamacao'
export type Confianca = 'alta' | 'media' | 'baixa'

export type SinalClassificado = {
  tipo: TipoDeSinal
  confianca: Confianca
}

/**
 * As expressões, por tipo, em ordem de força.
 *
 * Escritas sem acento de propósito: a normalização tira acento antes de
 * comparar, então `contratacao` casa com "contratação". Sem isso, metade dos
 * textos em português passaria batido.
 */
const EXPRESSOES: Record<TipoDeSinal, { forte: string[]; fraca: string[] }> = {
  contratacao: {
    forte: ['contratou', 'anuncia novo', 'assume como', 'nomeia', 'novo diretor', 'nova diretora'],
    fraca: ['vagas abertas', 'esta contratando', 'expansao de equipe', 'novo time'],
  },
  investimento: {
    forte: ['captou', 'rodada de investimento', 'aporte de', 'serie a', 'serie b', 'recebeu investimento'],
    fraca: ['busca investidores', 'planeja captar', 'rodada em negociacao'],
  },
  reclamacao: {
    forte: ['reclame aqui', 'processo judicial', 'nao entregou', 'nao resolveu', 'pessimo atendimento'],
    fraca: ['insatisfacao', 'demora no atendimento', 'clientes reclamam'],
  },
  dor: {
    forte: ['gargalo', 'nao consegue rastrear', 'perde prazo', 'falta de controle', 'planilha nao da conta'],
    fraca: ['desafio', 'dificuldade', 'problema operacional', 'ineficiencia'],
  },
}

/**
 * A ordem importa: um texto que fala de captação E de dificuldade é sinal de
 * investimento, que é o mais acionável para vender. Dor genérica fica por
 * último justamente porque é a mais fácil de casar por acidente.
 */
const PRIORIDADE: TipoDeSinal[] = ['investimento', 'contratacao', 'reclamacao', 'dor']

export function classificarSinal(
  texto: string,
  /**
   * O texto da consulta que produziu este trecho.
   *
   * Tudo que aparece aqui deixa de valer como evidência. Sem isto, a busca vira
   * um espelho: pergunto por gargalo, recebo "gargalo", concluo "há gargalo".
   */
  consulta = '',
): SinalClassificado | null {
  const t = normalizar(texto)
  if (t.length < 40) return null

  const daPergunta = normalizar(consulta)
  const vale = (e: string) => t.includes(e) && !(daPergunta && daPergunta.includes(e))

  for (const tipo of PRIORIDADE) {
    const { forte, fraca } = EXPRESSOES[tipo]
    if (forte.some(vale)) return { tipo, confianca: 'alta' }
    if (fraca.some(vale)) return { tipo, confianca: 'media' }
  }
  return null
}

/**
 * Minúscula, sem acento, espaço colapsado.
 *
 * `NFD` + remoção de diacrítico é o que faz "contratação" e "contratacao"
 * baterem. Sem isso a lista de expressões teria que existir em duas versões, e
 * a segunda divergiria da primeira na primeira edição.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

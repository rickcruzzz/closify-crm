/**
 * O que o agente descobre sobre a empresa ANTES de responder.
 *
 * ## Isto é lado do DONO, e a distinção não é formalidade
 *
 * Em 08/09 a pesquisa de mercado do CLIENTE saiu do produto — as tabelas
 * `enriquecimento_de_lead` e `sinal_de_mercado`, o card, o cron. O motivo
 * principal não foi custo: era que o recurso obrigava a declarar o Exa como
 * **suboperador fora do Brasil** na Política de Privacidade, com transferência
 * internacional de dado de titular, para um caminho que ninguém percorreu uma
 * vez.
 *
 * Este arquivo não reabre aquilo. Ele enriquece a empresa com quem **o dono**
 * está conversando, na própria prospecção dele — exatamente o que
 * `scripts/inteligencia/prospectar.mjs` já faz e que foi mantido de propósito
 * quando o resto saiu. Nenhum cliente aciona isto, nenhum dado de cliente sai
 * daqui, e a Política não muda.
 *
 * A regra que separa as duas coisas, para a próxima leitura: **se um cliente
 * pagante consegue disparar a chamada, é recurso de produto e exige declaração.
 * Se só o dono dispara, é ferramenta de trabalho dele.**
 *
 * ## Por que enriquecer, com o número
 *
 * O agente responde em 60 segundos contra as 42 horas da média do mercado, e
 * isso já é a maior vantagem. O enriquecimento ataca a outra metade: responder
 * rápido dizendo genérico é rápido e genérico.
 *
 * Uma resposta que cita o que a empresa de fato vende é a diferença entre
 * "mais um vendedor" e "alguém que olhou meu site antes de falar comigo" — e é
 * barato, porque a busca acontece uma vez por conversa, não por mensagem.
 */

/** Um resultado do Exa, reduzido ao que cabe num prompt. */
export type AchadoDaEmpresa = {
  titulo: string
  url: string
  trecho: string
}

/**
 * A consulta que descreve a empresa em vez de procurar o nome dela.
 *
 * Buscar `"SolarOn"` devolve homônimo, diretório de CNPJ e perfil de rede
 * social — foi o que sujou a colheita de 07/09, onde `br.pinterest.com` e
 * quatro sindicatos entraram na lista. Buscar pelo DOMÍNIO ancora na empresa
 * certa, e o resto da frase diz ao motor o que extrair.
 */
export function consultaSobreAEmpresa(dominio: string): string {
  const limpo = dominio.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!limpo) throw new Error('domínio vazio: a consulta ancoraria em nada')
  return `${limpo} o que a empresa faz, que serviços vende e para quem`
}

const RUIDO =
  /(pinterest|facebook\.com|instagram\.com|linkedin\.com|cnpj|guia|guide|econodata|solutudo|apontador|telelistas|reclameaqui)/i

/**
 * Descarta o que não é a empresa e corta o texto.
 *
 * O corte em 320 caracteres não é economia de token — é qualidade de resposta.
 * Contexto longo faz o modelo citar detalhe irrelevante para provar que leu, e
 * "vi que vocês atendem Curitiba e região desde 2014" numa primeira resposta
 * soa a vigilância, não a atenção.
 */
export function limparAchados(
  brutos: { title?: string | null; url: string; text?: string | null }[],
  teto = 3,
): AchadoDaEmpresa[] {
  const vistos = new Set<string>()
  const limpos: AchadoDaEmpresa[] = []

  for (const b of brutos) {
    if (!b.url || RUIDO.test(b.url)) continue
    let host: string
    try {
      host = new URL(b.url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (vistos.has(host)) continue
    vistos.add(host)

    const trecho = (b.text ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320)
    if (trecho.length < 60) continue

    limpos.push({ titulo: (b.title ?? host).slice(0, 90), url: b.url, trecho })
    if (limpos.length >= teto) break
  }

  return limpos
}

/**
 * O bloco que entra no prompt do agente.
 *
 * Vazio quando não houve achado — e essa é a decisão que evita o pior caso.
 * Um bloco com "não encontrei informações" convida o modelo a comentar a
 * ausência ("não achei muito sobre vocês, mas..."), que é pior que não
 * mencionar nada. Sem o bloco, ele simplesmente responde sem citar a empresa.
 */
export function contextoParaOPrompt(achados: AchadoDaEmpresa[]): string {
  if (achados.length === 0) return ''

  return [
    'O QUE ENCONTREI SOBRE A EMPRESA (use para responder com especificidade):',
    ...achados.map((a) => `- ${a.titulo}: ${a.trecho}`),
    '',
    'COMO USAR ISTO:',
    '- Demonstre que entendeu o negócio da pessoa, sem listar o que leu.',
    '- No máximo UMA referência ao que a empresa faz, e só se ela couber naturalmente.',
    '- Nunca diga "vi no site de vocês" nem "pesquisei sobre vocês". Soa a vigilância.',
    '- Se o que você encontrou não bate com o que a pessoa disse, acredite NELA.',
  ].join('\n')
}

/**
 * O agente pode chamar o Exa nesta conversa?
 *
 * Uma busca por conversa, nunca por mensagem. Sem esta trava, uma conversa de
 * vinte mensagens custaria vinte buscas para descobrir a mesma coisa — e o
 * crédito do Exa **acabou em 10/09** justamente por consumo que ninguém
 * contabilizou por chamada.
 */
export function devePesquisar(opcoes: {
  jaPesquisou: boolean
  mensagensNaConversa: number
}): boolean {
  if (opcoes.jaPesquisou) return false
  // Só na primeira ou segunda mensagem: depois disso a pessoa já disse quem é,
  // e o que ela diz vale mais que o que o site dela diz.
  return opcoes.mensagensNaConversa <= 2
}

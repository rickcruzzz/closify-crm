import type { CampanhaCompleta, ProntidaoDaConta, SaudeDaConta } from './meta-ads'

/**
 * O que impede a campanha de rodar, ou de render.
 *
 * ## Por que isto é função pura, e por que existe
 *
 * A tela anterior mostrava "Teste Pagamento · Pausada" com um botão Ligar ao
 * lado. Medido em 02/09 contra a conta real: aquela campanha tem conjunto e
 * criativo e **zero anúncios** — clicar em Ligar não veicularia nada. A tela
 * afirmava, pela ausência de qualquer aviso, que estava tudo pronto e faltava
 * só a decisão.
 *
 * A regra mora fora do componente porque decisão que a tela toma no meio do
 * JSX não tem como ser exercitada. Aqui ela é entrada e saída, e cada caso
 * ganha um teste com o número que o motivou.
 *
 * ## O que NÃO entra aqui
 *
 * Nada que dependa de gosto ("o criativo podia ser melhor") e nada que a Meta
 * já diga por conta própria — `recomendacoesDaMeta` tem seu próprio bloco na
 * tela. Só entra o que **impede** ou o que **gasta sem retorno possível**,
 * pela mesma régua de `/dono/alertas`: achado sem consequência descrita vira
 * ruído, e ruído ensina a ignorar a lista inteira.
 */
export type Impedimento = {
  /** `trava` impede veicular; `desperdicio` gasta sem poder converter. */
  tipo: 'trava' | 'desperdicio'
  titulo: string
  /** O que fazer. Sem isto o aviso transfere o problema para quem lê. */
  oQueFazer: string
  /** A campanha a que se refere, quando é específico de uma. */
  campanha?: string
}

/**
 * Objetivos de otimização que NÃO usam o pixel para conversão.
 *
 * A Meta otimiza pelo que se pede. Com `LINK_CLICKS` ela entrega cliques
 * baratos — e clique barato é o que menos importa para SaaS, onde o custo que
 * decide é por conta criada. O `estado-atual.md` já registra isso sobre a
 * campanha `OUTCOME_TRAFFIC` desta conta: objetivo de tráfego não usa o pixel
 * para conversão, e otimizar por ele é pagar o algoritmo para chutar.
 */
const OBJETIVOS_SEM_CONVERSAO = new Set([
  'LINK_CLICKS',
  'IMPRESSIONS',
  'REACH',
  'LANDING_PAGE_VIEWS',
  'POST_ENGAGEMENT',
  'PAGE_LIKES',
])

export function diagnosticar(prontidao: ProntidaoDaConta): Impedimento[] {
  const achados: Impedimento[] = []

  for (const c of prontidao.campanhas) {
    achados.push(...diagnosticarCampanha(c))
  }

  const saude = prontidao.saude.dados
  if (saude) achados.push(...diagnosticarConta(saude, prontidao.campanhas))

  if (!prontidao.temPixelCerto) {
    achados.push({
      tipo: 'desperdicio',
      titulo: 'O pixel do site não está nesta conta de anúncio',
      oQueFazer:
        'Sem ele a Meta não vê as conversões do site e otimiza às cegas. ' +
        'Compartilhe o pixel com esta conta no Business Manager.',
    })
  }

  return achados
}

function diagnosticarCampanha(c: CampanhaCompleta): Impedimento[] {
  const achados: Impedimento[] = []

  // A trava mais cara, porque é invisível: campanha ACTIVE sem anúncio parece
  // estar rodando em toda tela que só olhe o status.
  if (c.totalDeAnuncios === 0) {
    achados.push({
      tipo: 'trava',
      titulo: 'Esta campanha não tem nenhum anúncio',
      oQueFazer:
        'Ligar não vai veicular nada. Crie o anúncio dentro do conjunto ' +
        'antes de ativar — pelo Gerenciador de Anúncios, que é onde o criativo é escolhido.',
      campanha: c.nome,
    })
  }

  for (const s of c.conjuntos) {
    if (s.objetivo && OBJETIVOS_SEM_CONVERSAO.has(s.objetivo)) {
      achados.push({
        tipo: 'desperdicio',
        titulo: `O conjunto "${s.nome}" otimiza por ${rotuloDoObjetivo(s.objetivo)}`,
        oQueFazer:
          'Isso não usa o pixel para conversão: a Meta vai buscar clique barato, ' +
          'não conta criada. Para aquisição, o objetivo é conversão.',
        campanha: c.nome,
      })
    }
  }

  // Campanha viva sem conjunto é o mesmo buraco do "sem anúncio", um nível
  // acima — e acontece quando alguém apaga o conjunto e esquece a campanha.
  if (c.conjuntos.length === 0) {
    achados.push({
      tipo: 'trava',
      titulo: 'Esta campanha não tem conjunto de anúncio',
      oQueFazer: 'Sem conjunto não há público nem orçamento definido. Ela não roda.',
      campanha: c.nome,
    })
  }

  return achados
}

function diagnosticarConta(saude: SaudeDaConta, campanhas: CampanhaCompleta[]): Impedimento[] {
  const achados: Impedimento[] = []

  if (saude.status !== 1) {
    achados.push({
      tipo: 'trava',
      titulo: 'A conta de anúncio não está ativa',
      oQueFazer:
        `A Meta reporta status ${saude.status}` +
        (saude.motivoDaDesativacao ? ` (motivo ${saude.motivoDaDesativacao})` : '') +
        '. Nada veicula até resolver isso no Gerenciador.',
    })
  }

  // Saldo zero só é problema em conta PRÉ-PAGA. Numa conta de pós-pago é o
  // normal, e gritar aqui seria o alarme falso que treina a ignorar a lista —
  // por isso o aviso só sai quando há campanha ATIVA e nenhum gasto registrado,
  // que é a combinação que de fato indica cobrança não configurada.
  const temAtiva = campanhas.some((c) => c.ativa)
  if (temAtiva && saude.saldo === 0 && saude.gastoTotal === 0) {
    achados.push({
      tipo: 'trava',
      titulo: 'Campanha ativa, e a conta nunca gastou',
      oQueFazer:
        'Costuma ser forma de pagamento ausente ou recusada. ' +
        'Confira o meio de pagamento no Gerenciador.',
    })
  }

  return achados
}

/** O nome do objetivo em português, para quem não fala Graph API. */
export function rotuloDoObjetivo(objetivo: string): string {
  const nomes: Record<string, string> = {
    LINK_CLICKS: 'cliques no link',
    IMPRESSIONS: 'impressões',
    REACH: 'alcance',
    LANDING_PAGE_VIEWS: 'visitas à página',
    POST_ENGAGEMENT: 'engajamento',
    PAGE_LIKES: 'curtidas',
    OFFSITE_CONVERSIONS: 'conversões no site',
    LEAD_GENERATION: 'cadastros',
    VALUE: 'valor de compra',
  }
  return nomes[objetivo] ?? objetivo.toLowerCase().replace(/_/g, ' ')
}

/**
 * Liga o dinheiro gasto no anúncio ao cliente que pagou.
 *
 * ## Por que este é o número mais valioso da Central
 *
 * O Gerenciador da Meta sabe quanto você gastou e quantos cliques comprou. O
 * CRM sabe quem virou cliente pagante. **Nenhum dos dois sabe os dois lados** —
 * e a pergunta que decide se dá para escalar ("quanto me custou um cliente que
 * paga de verdade?") vive exatamente no cruzamento.
 *
 * Nenhuma ferramenta de terceiro pode responder isso aqui, porque nenhuma tem
 * acesso ao banco. É a vantagem de ter o CRM e o anúncio na mesma mão.
 *
 * A ponte já existe no schema: `workspaces` guarda `utm_source`,
 * `utm_campaign`, `fbc` e `fbp`, gravados por
 * `components/landing/utm-capture.tsx` quando alguém chega pela URL do anúncio.
 * Está construída e **nunca foi exercitada** — 0 de 24 empresas têm esses
 * campos, porque nenhuma campanha jamais rodou. Esta função é o primeiro
 * consumidor dela.
 *
 * Sem `server-only`: função pura, testável.
 */

import { chaveDeUtm } from '@/lib/marketing/utm'

/** Uma empresa, pelo pouco que a atribuição precisa saber dela. */
export type EmpresaAtribuivel = {
  id: string
  nome: string
  /** Campanha que trouxe a pessoa, quando ela chegou por um anúncio. */
  utmCampaign: string | null
  /**
   * Qual PEÇA trouxe, dentro da campanha.
   *
   * Os seis criativos apontam para o mesmo `/cadastro` e só se distinguem por
   * este campo. Sem ele, o relatório sabe que a campanha custou R$ X por
   * cliente e não sabe qual dos seis argumentos vendeu — que é a pergunta que
   * decide onde vai o dinheiro da semana seguinte.
   */
  utmContent: string | null
  /** Se veio de um clique de anúncio do Meta (o `fbclid` da URL). */
  veioDeCliqueDeAnuncio: boolean
  /**
   * Cadastrou o primeiro contato, ou seja, chegou a USAR o produto.
   *
   * É o mesmo degrau que `montarFunilDeAtivacao` chama de `primeiro_contato` e
   * o mesmo que dispara `CustomizeProduct` na Meta (`lib/analytics/ativacao.ts`).
   * Três superfícies, uma definição — divergirem faria a mesma pessoa contar
   * como ativada num lugar e não no outro.
   *
   * Está aqui porque separa dois fracassos que parecem iguais no total: a peça
   * que traz muita gente e ninguém usa (promessa errada) e a que traz pouca e
   * todas usam (público certo, alcance pequeno). A primeira precisa trocar de
   * argumento; a segunda, de orçamento.
   */
  ativou: boolean
  pagando: boolean
  criadoEm: string
}

/**
 * O que UMA peça (criativo) trouxe, dentro de uma campanha.
 *
 * ## Não há custo por peça, e isso é decisão, não esquecimento
 *
 * A Meta devolve gasto por CAMPANHA
 * (`meta-ads.ts`, `campaigns?fields=...insights{spend}`); os anúncios são lidos
 * com `fields=id,adset_id,campaign_id`, sem `insights`. Ou seja: **o gasto por
 * criativo não está disponível hoje.**
 *
 * Dividir o gasto da campanha entre as peças — por igual ou proporcional aos
 * cadastros — produziria um "custo por cliente" com aparência de medição e
 * origem em chute. A Meta não entrega orçamento igualmente entre criativos:
 * ela concentra em quem performa, então a divisão erraria justamente na peça
 * que mais importa. É a mesma classe de defeito que fez a Central declarar
 * R$ 490/mês de receita com R$ 0,00 real em 30/08.
 *
 * As contagens, sozinhas, já decidem: 20 cadastros com 1 ativação perde para 4
 * cadastros com 3 ativações e 2 pagantes, sem precisar saber quanto custou
 * cada uma. Quando o gasto por anúncio for lido de verdade, o campo entra
 * aqui — e não antes.
 */
export type DesempenhoDaPeca = {
  /** A chave normalizada. Estável, serve de `key` no React. */
  chave: string
  /** O `utm_content` como veio, ou o rótulo do balde não identificado. */
  rotulo: string
  /** Falso no balde de quem chegou pela campanha sem `utm_content` na URL. */
  identificada: boolean
  cadastros: number
  /** Desses, quantos cadastraram o primeiro contato. */
  ativaram: number
  /** Desses, quantos estão pagando agora. */
  clientesPagantes: number
}

/** O que uma campanha custou e trouxe. */
export type DesempenhoDaCampanha = {
  id: string
  nome: string
  ativa: boolean
  gasto: number
  cliques: number
  /** Quanto pode gastar por dia, em reais. `null` se o orçamento é por período. */
  orcamentoDiario: number | null
  /** Contas criadas que se identificaram como vindas desta campanha. */
  cadastros: number
  /** Dessas contas, quantas chegaram a cadastrar o primeiro contato. */
  ativaram: number
  /** Dessas contas, quantas estão pagando agora. */
  clientesPagantes: number
  /** Gasto ÷ cadastros. `null` quando ninguém se cadastrou ainda. */
  custoPorCadastro: number | null
  /**
   * Gasto ÷ quem ativou. `null` quando ninguém ativou ainda.
   *
   * O degrau intermediário, e o mais honesto para julgar campanha nova: o
   * pagamento demora dias para acontecer, então uma campanha boa parece ruim
   * pelo custo por cliente enquanto ninguém pagou ainda. Custo por ativação se
   * move no mesmo dia e já separa tráfego que usa de tráfego que só entra.
   */
  custoPorAtivacao: number | null
  /** Gasto ÷ clientes pagantes. O número que decide se dá para escalar. */
  custoPorCliente: number | null
  /**
   * O desdobramento por criativo. Vazio quando ninguém veio desta campanha.
   *
   * Ordenado por resultado, do melhor para o pior — e o balde não identificado
   * sempre por último, porque ele não é um concorrente das peças, é a medida do
   * que a URL do anúncio deixou de dizer.
   */
  pecas: DesempenhoDaPeca[]
  /**
   * Quantos meses de mensalidade para o cliente se pagar.
   *
   * `null` quando ainda não há cliente pagante. Acima de ~6 meses é sinal
   * amarelo em SaaS de PME: o cancelamento costuma chegar antes.
   */
  mesesParaSePagar: number | null
  /** Gastou e não trouxe ninguém — é onde o dinheiro vaza. */
  desperdicio: boolean
}

const segmentos = (valor: string | null): string[] =>
  chaveDeUtm(valor)
    .split('-')
    .filter((s) => s !== '')

/**
 * Se `procurados` aparece dentro de `dentro` como sequência CONTÍGUA.
 *
 * Por segmento, e não por `includes` de texto cru: `pro` é substring de
 * `producao`, e casar campanha por pedaço de palavra atribuiria cliente à
 * campanha errada — pior que não atribuir, porque parece resultado.
 */
function contemSequencia(dentro: string[], procurados: string[]): boolean {
  if (procurados.length === 0 || procurados.length > dentro.length) return false

  for (let i = 0; i <= dentro.length - procurados.length; i += 1) {
    if (procurados.every((s, j) => dentro[i + j] === s)) return true
  }
  return false
}

/**
 * Decide de qual campanha veio UMA empresa. `null` quando não dá para dizer.
 *
 * ## Por que não é comparação de igualdade, e o defeito que provou isso
 *
 * A campanha real se chama `Velo Funil — aquisicao (cadastro)` e os seis
 * criativos apontam para `...&utm_campaign=aquisicao_cadastro`. Conferido na
 * API da Meta em 04/09: os seis carregam `utm_content` corretamente, e **nenhum
 * casava com a campanha**. Todo cadastro cairia em "sem campanha identificada",
 * a tabela por peça apareceria vazia, e a campanha mostraria gasto com zero
 * resultado — atribuição quebrada com aparência de anúncio ruim.
 *
 * Não é erro de digitação: espaço, travessão e parêntese não cabem numa URL, e
 * o nome de campanha existe para ser lido no painel da Meta. **Os dois nunca vão
 * ser idênticos por escrito.** Casar por igualdade é frágil por construção — e
 * renomear a campanha no painel quebraria a atribuição em silêncio, sem nada na
 * tela avisando.
 *
 * ## A trava: ambiguidade não vira palpite
 *
 * Exato ganha de contido. Se sobrar mais de uma candidata, devolve `null` — a
 * empresa conta como "veio de anúncio, campanha desconhecida", que é
 * exatamente o que se sabe dela. Atribuir ao acaso poria receita de uma
 * campanha na conta de outra, e a decisão seguinte seria pausar a que funciona.
 */
function casarComCampanha(
  utmCampaign: string | null,
  campanhas: { id: string; nome: string }[],
): string | null {
  const alvo = segmentos(utmCampaign)
  if (alvo.length === 0) return null
  const chaveAlvo = alvo.join('-')

  const exatas = campanhas.filter((c) => chaveDeUtm(c.nome) === chaveAlvo)
  if (exatas.length === 1) return exatas[0].id
  // Duas campanhas com o mesmo nome: nem o dono saberia de qual veio.
  if (exatas.length > 1) return null

  const contidas = campanhas.filter(
    (c) => contemSequencia(segmentos(c.nome), alvo) || contemSequencia(alvo, segmentos(c.nome)),
  )
  return contidas.length === 1 ? contidas[0].id : null
}

/** O balde de quem veio pela campanha sem dizer por qual peça. */
const PECA_NAO_IDENTIFICADA = '__sem_peca__'

/**
 * Quebra as empresas de UMA campanha nas peças que as trouxeram.
 *
 * ## Quem não tem `utm_content` aparece, e não vira uma peça chamada "null"
 *
 * Descartar essas contas faria o total das peças ser menor que o da campanha
 * sem nada na tela explicando a diferença — e o gasto continuaria inteiro no
 * denominador, então toda peça pareceria melhor do que é. Agrupá-las sob o
 * rótulo cru (`null`, `""`) inventaria um criativo que não existe.
 *
 * O balde é visível e nomeado pelo que ele significa: a URL do anúncio está
 * incompleta. Mesma decisão de `semCampanhaIdentificada`, um nível acima.
 */
function desdobrarEmPecas(vindas: EmpresaAtribuivel[]): DesempenhoDaPeca[] {
  const porPeca = new Map<string, { rotulo: string; empresas: EmpresaAtribuivel[] }>()

  for (const empresa of vindas) {
    // Mesma normalização do nome de campanha: `a1_ancora_preco` e
    // `a1-ancora-preco` são a mesma peça escrita com separador diferente, e
    // separá-las dividiria o resultado de um criativo em duas linhas.
    const bruto = chaveDeUtm(empresa.utmContent)
    const chave = bruto === '' ? PECA_NAO_IDENTIFICADA : bruto
    const atual = porPeca.get(chave)

    if (atual) {
      atual.empresas.push(empresa)
      continue
    }

    porPeca.set(chave, {
      // O rótulo é o valor CRU da primeira ocorrência, não o normalizado:
      // `A1_Ancora_Preco` é o que está escrito na URL do anúncio, e é assim que
      // quem for procurar no Gerenciador vai reconhecer a peça.
      rotulo: chave === PECA_NAO_IDENTIFICADA ? 'Peça não identificada' : empresa.utmContent!.trim(),
      empresas: [empresa],
    })
  }

  // `forEach` e não espalhar o Map: o `target` do projeto é anterior a ES2015 e
  // `[...mapa]` exige `downlevelIteration`. Ligar a flag por causa de um laço
  // mudaria a compilação do projeto inteiro.
  const pecas: DesempenhoDaPeca[] = []
  porPeca.forEach(({ rotulo, empresas }, chave) => {
    pecas.push({
      chave,
      rotulo,
      identificada: chave !== PECA_NAO_IDENTIFICADA,
      cadastros: empresas.length,
      ativaram: empresas.filter((e) => e.ativou).length,
      clientesPagantes: empresas.filter((e) => e.pagando).length,
    })
  })

  return pecas.sort((a, b) => {
    // O balde não identificado desce sempre, mesmo tendo mais cadastros: ele
    // não é uma peça que ganhou, é a parte do resultado que não dá para atribuir.
    if (a.identificada !== b.identificada) return a.identificada ? -1 : 1

    // Pagante primeiro, ativação como desempate, cadastro por último — a ordem
    // do que decide investimento, não a do que é mais fácil de conseguir.
    return (
      b.clientesPagantes - a.clientesPagantes ||
      b.ativaram - a.ativaram ||
      b.cadastros - a.cadastros ||
      a.rotulo.localeCompare(b.rotulo)
    )
  })
}

/**
 * Cruza o gasto por campanha com as empresas que vieram dela.
 *
 * O casamento é por `utm_campaign`; dentro de cada campanha, as contas são
 * desdobradas por `utm_content` — ver `desdobrarEmPecas`.
 */
export function cruzarCampanhasComClientes(
  campanhas: {
    id: string
    nome: string
    ativa: boolean
    gasto: number
    cliques: number
    orcamentoDiario: number | null
  }[],
  empresas: EmpresaAtribuivel[],
  mensalidade: number,
): DesempenhoDaCampanha[] {
  // ## Resolver ANTES de agrupar, e não filtrar campanha por campanha
  //
  // O filtro por campanha permitia a mesma empresa casar com duas — e as duas
  // contariam o mesmo cliente pagante, cada uma dividindo o próprio gasto por
  // ele. Somando, o relatório mostraria mais clientes do que existem.
  //
  // Resolvido uma vez por empresa, "de qual campanha veio" passa a ter UMA
  // resposta, e a soma das campanhas fecha com a base.
  const campanhaDaEmpresa = new Map<string, string | null>(
    empresas.map((e) => [e.id, casarComCampanha(e.utmCampaign, campanhas)]),
  )

  return campanhas.map((campanha) => {
    const vindas = empresas.filter((e) => campanhaDaEmpresa.get(e.id) === campanha.id)
    const ativaram = vindas.filter((e) => e.ativou).length
    const pagantes = vindas.filter((e) => e.pagando).length

    const custoPorCadastro = vindas.length > 0 ? campanha.gasto / vindas.length : null
    const custoPorAtivacao = ativaram > 0 ? campanha.gasto / ativaram : null
    const custoPorCliente = pagantes > 0 ? campanha.gasto / pagantes : null

    return {
      ...campanha,
      cadastros: vindas.length,
      ativaram,
      clientesPagantes: pagantes,
      custoPorCadastro,
      custoPorAtivacao,
      custoPorCliente,
      pecas: desdobrarEmPecas(vindas),
      mesesParaSePagar:
        custoPorCliente !== null && mensalidade > 0 ? custoPorCliente / mensalidade : null,
      // Só é desperdício depois de gastar de verdade. Uma campanha que gastou
      // R$2 e não converteu não provou nada — o corte existe para não acusar
      // campanha nova que ainda está aprendendo.
      desperdicio: campanha.gasto >= 50 && vindas.length === 0,
    }
  })
}

/** O total, para o topo da página. */
export type ResumoDaAtribuicao = {
  gastoTotal: number
  cadastros: number
  /** Quantos dos cadastros chegaram a cadastrar o primeiro contato. */
  ativaram: number
  clientesPagantes: number
  custoPorCliente: number | null
  mesesParaSePagar: number | null
  /**
   * Quantas empresas vieram de anúncio mas não dá para dizer de qual campanha.
   *
   * Acontece quando o `fbclid` chegou mas o `utm_campaign` não foi posto na
   * URL. Aparecer na tela é de propósito: é o aviso de que a URL do anúncio
   * está incompleta e o relatório está subestimando o resultado.
   */
  semCampanhaIdentificada: number
  /**
   * Empresas que trazem um `utm_campaign` que não bate com NENHUMA campanha.
   *
   * Problema diferente do de cima, e mais insidioso: a URL do anúncio está
   * completa, o dado chegou inteiro, e mesmo assim a atribuição não fecha —
   * porque o nome não corresponde a campanha nenhuma da conta. Acontece quando
   * a campanha é renomeada no painel da Meta depois do anúncio no ar, ou quando
   * a URL aponta para um nome que nunca existiu.
   *
   * Sem este número, "a campanha gastou e não trouxe ninguém" e "a campanha
   * trouxe e o relatório não achou" são indistinguíveis na tela — e a decisão
   * seguinte seria pausar uma campanha que está funcionando.
   */
  comCampanhaNaoReconhecida: number
  /**
   * Quantas empresas a campanha reconhece mas a PEÇA não.
   *
   * Um nível abaixo de `semCampanhaIdentificada`, e um problema diferente: o
   * total da campanha está certo, o que falta é saber qual criativo pagou por
   * ele. Com seis anúncios apontando para o mesmo `/cadastro`, este número
   * subindo significa que o teste de argumento não vai concluir nada.
   */
  semPecaIdentificada: number
}

export function resumirAtribuicao(
  desempenho: DesempenhoDaCampanha[],
  empresas: EmpresaAtribuivel[],
  mensalidade: number,
): ResumoDaAtribuicao {
  const gastoTotal = desempenho.reduce((total, c) => total + c.gasto, 0)
  const cadastros = desempenho.reduce((total, c) => total + c.cadastros, 0)
  const ativaram = desempenho.reduce((total, c) => total + c.ativaram, 0)
  const clientesPagantes = desempenho.reduce((total, c) => total + c.clientesPagantes, 0)
  const custoPorCliente = clientesPagantes > 0 ? gastoTotal / clientesPagantes : null

  return {
    gastoTotal,
    cadastros,
    ativaram,
    clientesPagantes,
    custoPorCliente,
    mesesParaSePagar:
      custoPorCliente !== null && mensalidade > 0 ? custoPorCliente / mensalidade : null,
    semCampanhaIdentificada: empresas.filter((e) => e.veioDeCliqueDeAnuncio && !e.utmCampaign)
      .length,
    // Toda empresa contada em `cadastros` tem `utmCampaign` — `casarComCampanha`
    // devolve `null` para valor vazio. Então quem tem a marca e não foi contado
    // é exatamente quem não casou com campanha nenhuma, e a subtração basta:
    // não precisa da lista de campanhas aqui.
    comCampanhaNaoReconhecida: Math.max(
      0,
      empresas.filter((e) => e.utmCampaign).length - cadastros,
    ),
    // Sai do `desempenho`, não de `empresas`: só conta quem JÁ casou com uma
    // campanha. Contar direto na lista de empresas somaria quem não veio de
    // anúncio nenhum — toda conta orgânica tem `utm_content` nulo, e o aviso
    // passaria a acusar um defeito de URL que não existe.
    semPecaIdentificada: desempenho.reduce(
      (total, c) =>
        total + c.pecas.filter((p) => !p.identificada).reduce((n, p) => n + p.cadastros, 0),
      0,
    ),
  }
}

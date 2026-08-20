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

/** Uma empresa, pelo pouco que a atribuição precisa saber dela. */
export type EmpresaAtribuivel = {
  id: string
  nome: string
  /** Campanha que trouxe a pessoa, quando ela chegou por um anúncio. */
  utmCampaign: string | null
  /** Se veio de um clique de anúncio do Meta (o `fbclid` da URL). */
  veioDeCliqueDeAnuncio: boolean
  pagando: boolean
  criadoEm: string
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
  /** Dessas contas, quantas estão pagando agora. */
  clientesPagantes: number
  /** Gasto ÷ cadastros. `null` quando ninguém se cadastrou ainda. */
  custoPorCadastro: number | null
  /** Gasto ÷ clientes pagantes. O número que decide se dá para escalar. */
  custoPorCliente: number | null
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

/**
 * Cruza o gasto por campanha com as empresas que vieram dela.
 *
 * O casamento é por `utm_campaign`, comparado sem diferenciar maiúscula nem
 * espaço nas pontas: quem monta a URL do anúncio digita à mão, e um espaço a
 * mais não pode fazer um cliente pagante desaparecer do relatório.
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
  const normalizar = (valor: string | null) => valor?.trim().toLowerCase() ?? ''

  return campanhas.map((campanha) => {
    const chave = normalizar(campanha.nome)
    const vindas = empresas.filter((e) => normalizar(e.utmCampaign) === chave)
    const pagantes = vindas.filter((e) => e.pagando).length

    const custoPorCadastro = vindas.length > 0 ? campanha.gasto / vindas.length : null
    const custoPorCliente = pagantes > 0 ? campanha.gasto / pagantes : null

    return {
      ...campanha,
      cadastros: vindas.length,
      clientesPagantes: pagantes,
      custoPorCadastro,
      custoPorCliente,
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
}

export function resumirAtribuicao(
  desempenho: DesempenhoDaCampanha[],
  empresas: EmpresaAtribuivel[],
  mensalidade: number,
): ResumoDaAtribuicao {
  const gastoTotal = desempenho.reduce((total, c) => total + c.gasto, 0)
  const cadastros = desempenho.reduce((total, c) => total + c.cadastros, 0)
  const clientesPagantes = desempenho.reduce((total, c) => total + c.clientesPagantes, 0)
  const custoPorCliente = clientesPagantes > 0 ? gastoTotal / clientesPagantes : null

  return {
    gastoTotal,
    cadastros,
    clientesPagantes,
    custoPorCliente,
    mesesParaSePagar:
      custoPorCliente !== null && mensalidade > 0 ? custoPorCliente / mensalidade : null,
    semCampanhaIdentificada: empresas.filter((e) => e.veioDeCliqueDeAnuncio && !e.utmCampaign)
      .length,
  }
}

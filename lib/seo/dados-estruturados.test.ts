import { describe, expect, it } from 'vitest'

import { CONTROLADOR } from '@/lib/legal'
import { FREE_LEAD_LIMIT, PRO_ANUAL_MESES, PRO_PLAN_PRICE } from '@/lib/plans'

import { aplicacao, organizacao, perguntasFrequentes } from './dados-estruturados'

describe('dados estruturados da landing', () => {
  it('anuncia o preço que o produto de fato cobra', () => {
    const pro = aplicacao().offers.find((o) => o.name === 'Pro')
    expect(pro?.price).toBe(String(PRO_PLAN_PRICE))
    expect(pro?.priceCurrency).toBe('BRL')
  })

  /**
   * O teto do Free entra no texto porque "plano grátis" sem número obriga a
   * pessoa a procurar na página para saber se cabe nela — a mesma razão que a
   * FAQ da landing registra para citar o número lá.
   */
  it('mostra os TRÊS planos, e o grátis com preço zero', () => {
    const ofertas = aplicacao().offers
    expect(ofertas).toHaveLength(3)

    const gratis = ofertas.find((o) => o.name === 'Grátis')
    expect(gratis?.price).toBe('0')
    expect(gratis?.description).toContain(String(FREE_LEAD_LIMIT))
  })

  /**
   * ## O teste que existe para travar uma DECISÃO, não um comportamento
   *
   * `aggregateRating` e `review` são a marcação de maior retorno visual que
   * existe: com elas o Google desenha estrelas no resultado. E seriam prova
   * social inventada — não há um único cliente externo neste produto.
   *
   * A mesma regra que removeu a métrica falsa da `StatsSection` e que barra
   * depoimento fabricado no anúncio vale aqui, onde a tentação é maior porque
   * o ganho é visível na primeira busca.
   *
   * Há um segundo motivo, e ele é prático: marcar avaliação inexistente viola
   * a política de dados estruturados do Google, e a punição é ação manual —
   * o site perde TODO rich snippet, não só o falso.
   *
   * O teste varre o JSON inteiro em vez de checar campo a campo: assim ele
   * pega a marcação onde quer que alguém a coloque no futuro.
   */
  it('NÃO declara avaliação nem depoimento, em nenhum bloco', () => {
    const tudo = JSON.stringify([
      organizacao(),
      aplicacao(),
      perguntasFrequentes([{ q: 'p', a: 'r' }]),
    ])

    for (const proibido of ['aggregateRating', 'review', 'ratingValue', 'reviewCount']) {
      expect(tudo).not.toContain(proibido)
    }
  })

  it('transforma cada pergunta da página em Question com resposta', () => {
    const faq = perguntasFrequentes([
      { q: 'O plano grátis é grátis mesmo?', a: 'É, e não pede cartão.' },
      { q: 'Preciso instalar alguma coisa?', a: 'Não, roda no navegador.' },
    ])

    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity).toHaveLength(2)
    expect(faq.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'O plano grátis é grátis mesmo?',
      acceptedAnswer: { '@type': 'Answer', text: 'É, e não pede cartão.' },
    })
  })

  /**
   * `lib/legal.ts` deixa `cnpj` e `endereco` anuláveis de propósito: eles
   * ficaram nulos de 08/08 a 31/08, com a inscrição do MEI baixada, e a
   * landing simplesmente parou de exibi-los em vez de mostrar número morto.
   *
   * O dado estruturado tem de seguir a mesma regra — publicar `taxID` vazio
   * para o Google é pior que não publicar, porque afirma identidade com campo
   * em branco.
   */
  it('só declara o CNPJ quando ele existe', () => {
    const org = organizacao()
    if (CONTROLADOR.cnpj) {
      expect(org).toHaveProperty('taxID', CONTROLADOR.cnpj)
    } else {
      expect(org).not.toHaveProperty('taxID')
    }
  })

  /**
   * ## O endereço em CAMPOS, e o que o teste antigo não teria pegado
   *
   * Até 12/09 o `PostalAddress` recebia a linha inteira em `streetAddress` e
   * mais nada. Isso VALIDA no schema.org — um endereço com só a rua é um
   * endereço legítimo —, então nenhum validador reclamaria, e o Google
   * continuaria sem saber em que cidade a empresa fica.
   *
   * Este caso trava os três campos que ele lê para busca local. Ele falha no
   * dia em que alguém "simplificar" o bloco de volta para uma string, que é
   * exatamente o que aconteceria sem um teste, porque a versão simples
   * funciona em toda tela.
   */
  it('o endereço vai em CAMPOS, não numa linha só', () => {
    const org = organizacao() as { address?: Record<string, string> }
    const endereco = CONTROLADOR.endereco
    if (!endereco) {
      expect(org).not.toHaveProperty('address')
      return
    }
    expect(org.address).toMatchObject({
      '@type': 'PostalAddress',
      addressLocality: endereco.cidade,
      addressRegion: endereco.uf,
      addressCountry: 'BR',
    })
    // `streetAddress` leva rua, número e complemento — e NÃO o bairro, que o
    // schema não tem campo para representar.
    expect(org.address?.streetAddress).toContain(endereco.numero)
    expect(org.address?.streetAddress).not.toContain(endereco.bairro)
  })

  /**
   * O CEP sai sem máscara, e isso não é preferência de formato.
   *
   * `lib/legal.ts` guarda `41.820-021` porque é como a Receita imprime e é
   * como o rodapé exibe. A base de CEP do Google casa pelo código, e
   * `postalCode` com ponto é um valor que não existe na base dela — o campo
   * ficaria preenchido e inútil, que é pior que ausente porque parece certo.
   */
  it('o CEP do dado estruturado não leva a máscara', () => {
    const org = organizacao() as { address?: { postalCode?: string } }
    if (!CONTROLADOR.endereco) return
    expect(org.address?.postalCode).toMatch(/^\d{8}$/)
  })

  it('identifica o controlador pela razão social do cadastro', () => {
    expect(organizacao().legalName).toBe(CONTROLADOR.razaoSocial)
    expect(organizacao().name).toBe(CONTROLADOR.nomeFantasia)
  })
})

/**
 * ## O risco específico de publicar duas ofertas Pro
 *
 * Esta página existe para ser lida por buscador e por IA. Com `price: '49'` e
 * `price: '490'` lado a lado e nada dizendo o período de cada um, um LLM pode
 * passar a responder "R$ 490" como O preço do Velo Funil — dez vezes o que a
 * pessoa pagaria para começar.
 *
 * Os dois casos abaixo travam a desambiguação. Não são cosméticos: eles
 * protegem a primeira impressão de preço que um comprador tem.
 */
describe('as duas ofertas Pro não se confundem', () => {
  it('a oferta de menor preço continua sendo a mensal', () => {
    const pagas = aplicacao()
      .offers.filter((o) => Number(o.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))
    expect(pagas[0]?.name).toBe('Pro')
    expect(pagas[0]?.price).toBe(String(PRO_PLAN_PRICE))
  })

  it('cada oferta paga declara o período que cobre', () => {
    for (const oferta of aplicacao().offers.filter((o) => Number(o.price) > 0)) {
      expect(oferta.priceSpecification, oferta.name).toBeDefined()
      expect(oferta.priceSpecification?.unitCode, oferta.name).toBe('MON')
    }
    const mensal = aplicacao().offers.find((o) => o.name === 'Pro')
    const anual = aplicacao().offers.find((o) => o.name === 'Pro anual')
    expect(mensal?.priceSpecification?.billingDuration).toBe(1)
    expect(anual?.priceSpecification?.billingDuration).toBe(PRO_ANUAL_MESES)
  })

  // Publicar um "anual" que custa doze mensalidades seria anunciar um desconto
  // que não existe, na superfície que o Google lê.
  it('o anual publicado é mais barato que doze mensais', () => {
    const anual = aplicacao().offers.find((o) => o.name === 'Pro anual')
    expect(Number(anual?.price)).toBeLessThan(PRO_PLAN_PRICE * PRO_ANUAL_MESES)
  })
})

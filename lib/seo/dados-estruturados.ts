import { CONTROLADOR } from '@/lib/legal'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * Os dados estruturados (JSON-LD) que a landing publica para o Google.
 *
 * ## O que isto resolve, medido em 03/09
 *
 * Buscando "velofunil.com.br CRM Velo Funil" o site **não aparecia** — nem
 * pelo nome próprio. A auditoria mostrou que o lado técnico estava correto:
 *
 *     robots.txt      Allow: / e o sitemap declarado
 *     sitemap.xml     responde 200, com as URLs
 *     meta robots     index, follow
 *     title/desc      preenchidos, com o diferencial e o preço
 *     JSON-LD         ZERO blocos          <- o buraco
 *
 * Sem dado estruturado o Google lê a página como texto solto: não sabe que é
 * um software, não sabe que tem preço, não sabe que há perguntas frequentes.
 * O resultado sai como link azul e nada mais — enquanto concorrente com
 * `Product` marcado mostra preço e avaliação, ocupando três vezes mais tela.
 *
 * ## Por que função pura, e não JSX espalhado
 *
 * Cada número aqui vem de uma constante que já existe: preço de `lib/plans`,
 * CNPJ e razão social de `lib/legal`. Escrever à mão criaria uma segunda cópia
 * do preço — e a que diverge em silêncio é sempre a que ninguém está olhando.
 * É a mesma razão pela qual `lib/dono/perfil-instagram.ts` deriva a bio das
 * constantes em vez de repetir o texto.
 *
 * ## O que NÃO entra, e é a mesma decisão de sempre
 *
 * `aggregateRating` e `review`. O Google mostra estrelas no resultado quando
 * eles existem, e é a marcação de maior retorno visual que existe — e seria
 * prova social inventada, porque não há um único cliente externo. A mesma
 * regra que removeu a métrica falsa da `StatsSection` e que barra depoimento
 * fabricado nos anúncios vale aqui, onde a tentação é maior porque o ganho é
 * visível.
 *
 * Marcar avaliação inexistente também viola a política de dados estruturados
 * do Google, e o castigo é a ação manual: o site perde TODO rich snippet, não
 * só o falso.
 */

const SITE = 'https://www.velofunil.com.br'

/** Perguntas da landing, na mesma ordem em que ela as mostra. */
export type PerguntaFrequente = { q: string; a: string }

/**
 * A organização por trás do produto.
 *
 * O CNPJ entra como `taxID` porque é o identificador que o Google reconhece
 * para empresa brasileira, e é o mesmo número que a landing já exibe no
 * rodapé — declarar coisas diferentes nos dois lugares é o defeito que os
 * cinco e-mails com CNPJ baixado custaram em 31/08.
 */
export function organizacao() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: CONTROLADOR.nomeFantasia,
    legalName: CONTROLADOR.razaoSocial,
    url: SITE,
    logo: `${SITE}/icon.png`,
    email: CONTROLADOR.email,
    ...(CONTROLADOR.cnpj ? { taxID: CONTROLADOR.cnpj } : {}),
    ...(CONTROLADOR.endereco
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: CONTROLADOR.endereco,
            addressCountry: 'BR',
          },
        }
      : {}),
  }
}

/**
 * O produto, com o preço que a página anuncia.
 *
 * `offers` traz os DOIS planos porque a página anuncia os dois, e um resultado
 * de busca que mostra só o pago esconde justamente a porta de entrada. O
 * gratuito vai com `price: '0'`, que é como o schema representa gratuito — não
 * omitindo o campo.
 */
export function aplicacao() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: CONTROLADOR.nomeFantasia,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'CRM',
    // Roda no navegador, sem instalar — que é literalmente uma das perguntas
    // frequentes da própria landing.
    operatingSystem: 'Web',
    url: SITE,
    inLanguage: 'pt-BR',
    offers: [
      {
        '@type': 'Offer',
        name: 'Grátis',
        price: '0',
        priceCurrency: 'BRL',
        description: `Até ${FREE_LEAD_LIMIT} contatos, sem cartão e sem prazo para decidir.`,
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: String(PRO_PLAN_PRICE),
        priceCurrency: 'BRL',
        // O diferencial em texto, porque é ele que separa este produto do
        // resto da categoria: todo concorrente mapeado cobra por assento.
        description:
          `R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira, ` +
          'com uma pessoa ou com vinte. Não cobramos por vendedor.',
      },
    ],
  }
}

/**
 * As perguntas frequentes.
 *
 * É a marcação de maior retorno para esta página: o Google expande as
 * perguntas no próprio resultado, e o anúncio de um concorrente não consegue
 * ocupar esse espaço. Também é a única das três que depende de conteúdo real
 * da página — marcar pergunta que não está no HTML é violação de política.
 */
export function perguntasFrequentes(perguntas: readonly PerguntaFrequente[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: perguntas.map((p) => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  }
}

/**
 * Serializa JSON-LD para dentro de uma tag `<script>` sem risco de quebrá-la.
 *
 * ## O caractere que estraga tudo
 *
 * `JSON.stringify` não escapa `<`, então um texto que contenha `</script>` —
 * hoje impossível, porque tudo aqui é literal do próprio código, mas trivial
 * de introduzir amanhã ao puxar uma pergunta de um CMS — fecharia a tag no
 * meio do JSON e jogaria o resto como HTML na página.
 *
 * Escapar `<` cobre esse caso; `\u2028` e `\u2029` são separadores de linha
 * que o JSON aceita e o parser de JavaScript recusa, e quebram o script pelo
 * mesmo caminho.
 *
 * É a forma que a documentação do Next recomenda para JSON-LD, e o custo é uma
 * substituição de string.
 */
export function paraScript(dados: unknown): string {
  return JSON.stringify(dados)
    .replace(/</g, '\u003c')
    .replace(/\u2028/g, '\u2028')
    .replace(/\u2029/g, '\u2029')
}

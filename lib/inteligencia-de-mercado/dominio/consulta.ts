/**
 * Monta a busca semântica a partir do que o CRM já sabe do lead.
 *
 * ## Por que semântica e não palavra-chave
 *
 * `"LogiTech Transportes"` devolve o site institucional da empresa, que ela
 * mesma escreveu — exatamente a fonte que NÃO tem a dor. O que interessa está
 * em reclamação de cliente, notícia de contratação, post de fórum. Isso só
 * aparece perguntando pela INTENÇÃO, e é para isso que o `useAutoprompt` do
 * Exa existe.
 *
 * ## O domínio NÃO restringe a busca, e isso foi medido
 *
 * A primeira versão mandava `includeDomains: [dominio]`, limitando a busca ao
 * site da empresa. Medido contra a API real em 06/09/2026: **6 trechos do site
 * institucional produziram ZERO sinais**, enquanto a mesma pergunta sem filtro
 * de domínio trouxe duas reclamações no Reclame Aqui.
 *
 * Faz sentido depois de visto: o site é a única fonte que a empresa controla, e
 * ninguém publica a própria dor. A dor mora em reclamação, notícia e fórum —
 * exatamente o que o filtro excluía.
 *
 * O domínio continua entrando na consulta como TERMO, porque desambigua. Só não
 * cerca mais o resultado.
 *
 * ## Nome E domínio juntos, medido em A/B
 *
 * Nome de empresa é ambíguo — "Ápice" existe em consultoria, em construção e em
 * clínica — e buscar só por nome traz a homônima. Mas o domínio sozinho também
 * perde: ninguém escreve "rdstation.com" no Reclame Aqui, escreve "RD Station".
 *
 * Medido contra a API real em 06/09/2026, mesma pergunta, quatro formas:
 *
 *     dominio + segmento do usuario   0 sinais
 *     so o dominio                    1
 *     so o nome                       1
 *     NOME (dominio)                  2
 *
 * O nome é como as pessoas escrevem; o domínio, entre parênteses, desambigua a
 * homônima. Os dois juntos acham o dobro.
 *
 * ## E o segmento SAIU, porque descrevia a empresa errada
 *
 * A primeira versão acrescentava `workspaces.segmento` à consulta. Esse campo é
 * o segmento da empresa do USUÁRIO — de quem usa o CRM —, não o do lead que
 * está sendo pesquisado. Acrescentá-lo dizia ao Exa que a RD Station é "do
 * setor de Tecnologia" porque QUEM PERGUNTOU é de tecnologia.
 *
 * Custou os 2 sinais inteiros: a variante com segmento devolveu zero. O CRM não
 * pergunta o segmento de cada contato, então não há de onde tirar o certo — e
 * um campo aproximado que piora a resposta é pior que campo nenhum.
 */

/** O mínimo que o módulo precisa saber. Ver `ports/leads.ts`. */
export type AlvoDeBusca = {
  nome: string
  empresa: string | null
  /**
   * Domínio da empresa, sem protocolo. `null` quando não dá para saber.
   *
   * **O CRM não tem campo de site** — conferido no catálogo em 06/09: `leads`
   * tem `id, workspace_id, owner_id, name, email, phone, company, status,
   * value, created_at`. O domínio sai do e-mail, por `dominioDoEmail`.
   */
  dominio: string | null
}

/**
 * Provedores de e-mail pessoal.
 *
 * Sem esta lista, `joao@gmail.com` viraria uma busca sobre **o Gmail** — e o
 * resultado seria plausível, longo e completamente alheio ao lead. É a classe
 * de erro mais cara deste projeto: número plausível, conclusão errada.
 *
 * A lista é curta e cobre o que aparece numa base brasileira de PME. Domínio
 * fora dela e sem sinal de ser pessoal passa: errar para o lado de buscar é
 * recuperável (custa US$ 0,007 e devolve nada), errar para o lado de não buscar
 * apaga o recurso em silêncio.
 */
const PROVEDORES_PESSOAIS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com',
  'outlook.com.br', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br',
  'icloud.com', 'me.com', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'ig.com.br', 'globo.com', 'globomail.com', 'r7.com', 'zipmail.com.br',
  'proton.me', 'protonmail.com', 'yandex.com',
])

/**
 * Tira o domínio da empresa a partir do e-mail do lead.
 *
 * `null` para provedor pessoal e para e-mail malformado. Em B2B o e-mail
 * corporativo É o domínio da empresa, e essa é a única fonte de domínio que
 * este CRM tem.
 */
export function dominioDoEmail(email: string | null | undefined): string | null {
  const limpo = email?.trim().toLowerCase()
  if (!limpo) return null

  const partes = limpo.split('@')
  if (partes.length !== 2) return null

  const dominio = normalizarDominio(partes[1])
  if (!dominio) return null
  if (PROVEDORES_PESSOAIS.has(dominio)) return null
  return dominio
}

export type ConsultaMontada = {
  texto: string
  /**
   * Sempre vazio hoje. O campo fica porque o cliente do Exa o repassa e porque
   * há um uso legítimo à vista: buscar DENTRO de um portal de reclamação.
   * Restringir ao site da empresa é que está medido como errado — ver acima.
   */
  dominios: string[]
  /**
   * Só resultado publicado depois disto.
   *
   * Dor de dois anos atrás ou já foi resolvida ou não é notícia. E o custo de
   * ler o passado é o mesmo de ler o presente.
   */
  publicadoDepoisDe: string
}

export const JANELA_DE_BUSCA_MESES = 12

/**
 * `null` quando não há por onde buscar.
 *
 * Devolver uma consulta fraca seria pior que não buscar: gasta crédito do Exa
 * e devolve ruído que o extrator vai tentar transformar em dor.
 */
export function montarConsulta(
  alvo: AlvoDeBusca,
  agora: Date,
): ConsultaMontada | null {
  const empresa = alvo.empresa?.trim() || null
  const dominio = normalizarDominio(alvo.dominio)
  if (!empresa && !dominio) return null

  // Nome primeiro, domínio entre parênteses. Quando só há um dos dois, usa o
  // que há. Ver o A/B no cabeçalho.
  const referencia = empresa && dominio ? `${empresa} (${dominio})` : (empresa ?? dominio!)

  return {
    texto:
      `Reclamações de clientes, problemas relatados, contratações e captações ` +
      `recentes envolvendo ${referencia}`,
    dominios: [],
    publicadoDepoisDe: mesesAtras(agora, JANELA_DE_BUSCA_MESES),
  }
}

/**
 * Tira protocolo, `www.`, caminho e porta.
 *
 * O CRM aceita o que a pessoa digitou, e ela digita de tudo:
 * `https://site.com.br/contato`, `www.site.com.br`, `site.com.br `. O filtro de
 * domínio do Exa só aceita o host puro — com qualquer sobra ele não casa com
 * nada e a busca volta vazia, sem erro nenhum.
 */
export function normalizarDominio(bruto: string | null | undefined): string | null {
  const limpo = bruto?.trim().toLowerCase()
  if (!limpo) return null

  const semProtocolo = limpo.replace(/^[a-z]+:\/\//, '')
  const host = semProtocolo.split('/')[0].split('?')[0].split('#')[0].split(':')[0]
  const semWww = host.replace(/^www\./, '')

  // Precisa ter ao menos um ponto e nada de espaço: "minha empresa" não é
  // domínio, e mandá-lo como filtro zeraria a busca em silêncio.
  if (!semWww.includes('.') || /\s/.test(semWww)) return null
  return semWww
}

function mesesAtras(agora: Date, meses: number): string {
  const d = new Date(agora)
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

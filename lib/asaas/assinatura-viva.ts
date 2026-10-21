import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'

/**
 * "Esta assinatura ainda está viva no Asaas?", num lugar só.
 *
 * ## Por que ela existe: o predicado estava em QUATRO cópias
 *
 *     lib/dono/dinheiro.ts:71
 *     lib/dono/dinheiro-do-vigia.ts:59
 *     lib/dono/central.ts:69
 *     lib/dono/pendencias.ts:128
 *
 * Os quatro escreviam `a.status === 'ACTIVE' && !a.deleted`, com o comentário
 * explicativo duplicado em dois deles. A separação dos ARQUIVOS é deliberada e
 * bem justificada (`dinheiro-do-vigia.ts:9-31` argumenta por que o vigia não
 * pode depender do gate da Central); o que veio junto sem precisar foi o
 * predicado. Quatro lugares que precisam concordar sobre o que é dinheiro
 * entrando, e nada travando a concordância.
 *
 * ## O `deleted` é o descarte real, e é contraintuitivo
 *
 * Uma assinatura cancelada continua aparecendo na lista do Asaas com
 * `status: ACTIVE` e `deleted: true`. Ler só o `status` infla o número de
 * clientes que parecem estar pagando — foi o defeito medido em 12/09.
 */
export type AssinaturaDoAsaas = {
  id?: string
  status?: string | null
  deleted?: boolean | null
}

/**
 * Pura, e por isso testável sem rede.
 *
 * `deleted` ausente conta como NÃO apagada: é o que o Asaas devolve para
 * assinatura normal, e tratar a ausência como apagada esconderia receita real.
 */
export function assinaturaEstaViva(a: AssinaturaDoAsaas): boolean {
  return a.status === 'ACTIVE' && !a.deleted
}

/**
 * O estado de UMA assinatura, direto da fonte.
 *
 * ## Por que perguntar pela ASSINATURA e não pelo pagamento
 *
 * `buscarPagamentoMaisRecente` responde "como foi o último pagamento", e é a
 * pergunta certa para quem está `trialing` ou `past_due`: ali o que se quer
 * saber é se entrou dinheiro.
 *
 * Para quem está `active` ela é a pergunta ERRADA, e isso foi medido: o
 * pagamento mais recente de uma assinatura viva é quase sempre a fatura do
 * ciclo seguinte, com status `PENDING`. `PENDING` não está em nenhum dos três
 * conjuntos de `status-real.ts`, então `statusMapeado` sai `null` e a linha é
 * pulada — o estorno do mês passado nunca seria visto, porque ele não é o
 * pagamento mais recente.
 *
 * `GET /subscriptions/{id}` responde a pergunta que importa aqui: ela ainda
 * existe?
 *
 * ## `null` significa NÃO SEI, nunca "morreu"
 *
 * Asaas fora do ar, timeout, 500: devolve `null`, e quem chama trata como
 * "não deu para saber" e não mexe em nada. É a lição de 30/08, e aqui ela vale
 * dinheiro nos dois sentidos — cancelar a assinatura de quem paga por causa de
 * um timeout é pior que o defeito que este arquivo conserta.
 *
 * O 404 é a exceção, e é o único caso em que a ausência É resposta: assinatura
 * que o Asaas não conhece mais está morta para todos os efeitos.
 */
export async function buscarAssinaturaNoAsaas(
  asaasSubscriptionId: string,
): Promise<{ viva: boolean } | null> {
  try {
    const a = await asaasFetch<AssinaturaDoAsaas>(`/subscriptions/${asaasSubscriptionId}`)
    return { viva: assinaturaEstaViva(a) }
  } catch (err) {
    if (err instanceof AsaasApiError && err.status === 404) return { viva: false }
    if (err instanceof AsaasApiError) {
      console.error(
        `buscarAssinaturaNoAsaas: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 300),
      )
    } else {
      console.error('buscarAssinaturaNoAsaas: falha ao consultar o Asaas', err)
    }
    return null
  }
}

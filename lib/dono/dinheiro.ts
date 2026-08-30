import 'server-only'

import { asaasFetch } from '@/lib/asaas/client'

import { exigirAmbienteLocal } from './somente-local'
import type { AssinaturaNoAsaas, DinheiroNoAsaas, Resultado } from './tipos'

type ListaDeCobrancas = { totalCount: number; data: { value: number }[] }
type ListaDeAssinaturas = {
  totalCount: number
  data: { id: string; status: string; deleted: boolean }[]
}
type ListaDePagamentos = {
  totalCount: number
  data: { value: number; subscription: string | null }[]
}

/**
 * O que o Asaas diz sobre o dinheiro, sem passar pelo nosso banco.
 *
 * ## Por que ler o gateway direto em vez de confiar em `subscriptions`
 *
 * Porque as duas fontes DIVERGEM, e a divergência é o achado que motivou esta
 * tela. Em 20/08/2026, medido: 4 assinaturas ativas no Asaas contra 2 empresas
 * marcadas como Pro no banco — três pessoas com assinatura viva no gateway sem
 * receber o plano, e uma assinatura de teste dando Pro de graça em produção.
 *
 * O banco sabe o que o webhook conseguiu gravar. O Asaas sabe o que de fato
 * aconteceu com o dinheiro. Quando os dois discordam, quem está certo é o
 * gateway — e é por isso que esta função existe separada de `queries.ts`.
 */
export async function lerDinheiro(): Promise<Resultado<DinheiroNoAsaas>> {
  await exigirAmbienteLocal()

  try {
    const [saldo, aReceber, vencido, recebido, assinaturas] = await Promise.all([
      asaasFetch<{ balance: number }>('/finance/balance'),
      asaasFetch<ListaDeCobrancas>('/payments?status=PENDING&limit=100'),
      asaasFetch<ListaDeCobrancas>('/payments?status=OVERDUE&limit=100'),
      asaasFetch<ListaDeCobrancas>('/payments?status=RECEIVED&limit=100'),
      asaasFetch<ListaDeAssinaturas>('/subscriptions?limit=100'),
    ])

    const somar = (lista: ListaDeCobrancas) =>
      lista.data.reduce((total, cobranca) => total + (cobranca.value ?? 0), 0)

    return {
      ok: true,
      dados: {
        saldo: saldo.balance,
        aReceber: { quantidade: aReceber.totalCount, total: somar(aReceber) },
        vencido: { quantidade: vencido.totalCount, total: somar(vencido) },
        recebido: { quantidade: recebido.totalCount, total: somar(recebido) },
        // `deleted` é o descarte real: uma assinatura cancelada continua
        // aparecendo na lista com `status: ACTIVE` e `deleted: true`, e contá-la
        // inflaria o número de clientes que parecem estar pagando.
        assinaturasAtivas: assinaturas.data.filter((a) => a.status === 'ACTIVE' && !a.deleted)
          .length,
      },
    }
  } catch (err) {
    // Devolve erro em vez de lançar: o Asaas fora do ar não pode derrubar a
    // lista de clientes, que vem de outra fonte e está perfeitamente
    // disponível. A tela mostra a falha só neste bloco.
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o Asaas.',
    }
  }
}

/**
 * Só a lista crua de assinaturas, para o cruzamento que gera as pendências.
 *
 * Separada de `lerDinheiro` porque tem outro consumidor e outro momento de
 * falha: aqui, não conseguir a lista significa "não sei dizer se há
 * divergência", que é diferente de "não sei o saldo".
 */
export async function listarAssinaturasDoAsaas(): Promise<Resultado<AssinaturaNoAsaas[]>> {
  await exigirAmbienteLocal()

  try {
    const resposta = await asaasFetch<ListaDeAssinaturas>('/subscriptions?limit=100')
    return { ok: true, dados: resposta.data }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui listar assinaturas no Asaas.',
    }
  }
}

/**
 * Quais assinaturas do Asaas de fato RECEBERAM dinheiro.
 *
 * ## Por que uma chamada só, e não uma por assinatura
 *
 * A alternativa seria `GET /payments?subscription=<id>` para cada uma — sete
 * idas de rede hoje, e uma por cliente amanhã, numa tela que já leva 1,7s.
 * Uma lista de pagamentos confirmados e o cruzamento em memória custa duas
 * chamadas e não cresce com o número de clientes.
 *
 * ## RECEIVED **e** CONFIRMED, os dois
 *
 * `CONFIRMED` é cartão aprovado com o repasse ainda a caminho; `RECEIVED` é
 * dinheiro na conta. Para "esta assinatura é receita?" os dois valem — deixar
 * o CONFIRMED de fora faria toda assinatura no cartão sumir do MRR nos dias
 * entre a aprovação e o repasse.
 *
 * `OVERDUE` e `PENDING` ficam de fora de propósito: cobrança gerada não é
 * dinheiro, e contá-la seria a mesma confusão entre intenção e receita que
 * esta correção existe para desfazer.
 */
export async function assinaturasComPagamento(): Promise<Resultado<Set<string>>> {
  await exigirAmbienteLocal()

  try {
    const [recebidos, confirmados] = await Promise.all([
      asaasFetch<ListaDePagamentos>('/payments?status=RECEIVED&limit=100'),
      asaasFetch<ListaDePagamentos>('/payments?status=CONFIRMED&limit=100'),
    ])

    const ids = new Set<string>()
    for (const pagamento of [...recebidos.data, ...confirmados.data]) {
      // Cobrança avulsa não tem `subscription`, e é o caso de todo pagamento
      // que não veio de assinatura — ignorá-lo aqui é correto.
      if (pagamento.subscription) ids.add(pagamento.subscription)
    }

    return { ok: true, dados: ids }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui ler os pagamentos no Asaas.',
    }
  }
}

import 'server-only'

import { asaasFetch } from '@/lib/asaas/client'

import { exigirAmbienteLocal } from './somente-local'
import type { DinheiroNoAsaas, Resultado } from './tipos'

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
    const [saldo, aReceber, vencido, recebido, confirmados, assinaturas] = await Promise.all([
      asaasFetch<{ balance: number }>('/finance/balance'),
      asaasFetch<ListaDePagamentos>('/payments?status=PENDING&limit=100'),
      asaasFetch<ListaDePagamentos>('/payments?status=OVERDUE&limit=100'),
      asaasFetch<ListaDePagamentos>('/payments?status=RECEIVED&limit=100'),
      // `CONFIRMED` é cartão aprovado com o repasse a caminho; `RECEIVED` é
      // dinheiro na conta. Para "esta assinatura é receita?" os dois valem —
      // sem o CONFIRMED, assinatura no cartão sumiria do MRR nos dias entre a
      // aprovação e o repasse.
      asaasFetch<ListaDePagamentos>('/payments?status=CONFIRMED&limit=100'),
      asaasFetch<ListaDeAssinaturas>('/subscriptions?limit=100'),
    ])

    const somar = (lista: ListaDePagamentos) =>
      lista.data.reduce((total, cobranca) => total + (cobranca.value ?? 0), 0)

    // Quais assinaturas de fato RECEBERAM dinheiro. Cruzamento em memória
    // sobre listas que já vieram — a alternativa seria
    // `GET /payments?subscription=<id>` uma vez por assinatura, que cresce com
    // o número de clientes e foi o que estourou o limite do Asaas em 30/08.
    const comPagamento = new Set<string>()
    for (const pagamento of [...recebido.data, ...confirmados.data]) {
      // Cobrança avulsa não tem `subscription`, e ignorá-la aqui é correto.
      if (pagamento.subscription) comPagamento.add(pagamento.subscription)
    }

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
        // A lista CRUA, para o cruzamento das pendências não precisar buscá-la
        // de novo — era literalmente a mesma chamada, feita duas vezes.
        assinaturas: assinaturas.data,
        comPagamento,
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
 * ## Por que estas duas funções deixaram de existir
 *
 * `listarAssinaturasDoAsaas()` e `assinaturasComPagamento()` faziam as PRÓPRIAS
 * chamadas ao gateway, e duas delas eram idênticas às de `lerDinheiro`:
 * `/subscriptions` e `/payments?status=RECEIVED` iam ao Asaas **duas vezes por
 * abertura** da Central.
 *
 * Eram 8 chamadas por F5. Em 30/08 o Asaas devolveu
 * `429 — acesso temporariamente bloqueado por exceder o limite`, e a Central
 * inteira ficou sem dinheiro na tela.
 *
 * Agora é uma leitura só (6 chamadas, sem repetição), e tudo que os
 * consumidores precisam sai de `DinheiroNoAsaas`. O rate limit do Asaas é do
 * tipo que pune a aplicação inteira, não só a chamada repetida — e a tela que
 * mais bate nele é a que roda em `localhost` e é recarregada à toa.
 */

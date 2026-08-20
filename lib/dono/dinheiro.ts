import 'server-only'

import { asaasFetch } from '@/lib/asaas/client'

import { exigirAmbienteLocal } from './somente-local'
import type { AssinaturaNoAsaas, DinheiroNoAsaas, Resultado } from './tipos'

type ListaDeCobrancas = { totalCount: number; data: { value: number }[] }
type ListaDeAssinaturas = {
  totalCount: number
  data: { id: string; status: string; deleted: boolean }[]
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

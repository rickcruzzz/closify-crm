import 'server-only'

import { cifrar, decifrar } from '@/lib/integrations/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIMEOUT_NA_ACTION_MS, estourouOTempo } from '@/lib/whatsapp/orcamento-de-tempo'
import { statusDaInstancia } from '@/lib/whatsapp/zapi'

/**
 * A reserva de instâncias já compradas, esperando o próximo cliente.
 *
 * ## O defeito que isto fecha é de PRODUTO, e a regra é do dono
 *
 * *"Tudo tem que ser de igual pra igual pra qualquer pagante."*
 *
 * Sem reserva, um cliente que paga o Max e clica em "Conectar" dispara um
 * e-mail para o dono, e daí em diante depende de uma pessoa estar disponível
 * para criar a instância no painel, **mandar o token por fora** e pedir que ele
 * cole num bloco escrito *"Já tenho uma instância na Z-API"* — que é falso para
 * ele, porque quem criou fomos nós.
 *
 * Isso é atendimento pessoal disfarçado de recurso, e quebra no primeiro
 * cliente que assina num domingo.
 *
 * ## Por que não o Partner, que seria o caminho limpo
 *
 * O Partner da Z-API cria instância por API. Ele exige **dez contratadas**,
 * R$ 899,90/mês fixos, medido em 17/09, e o empate com a avulsa só acontece no
 * nono cliente. Com zero cliente Max, é pagar por vaga vazia.
 *
 * A reserva entrega o MESMO resultado ao cliente sem esse custo: o dono compra
 * avulso, uma de cada vez, e o dinheiro de quem paga financia a próxima.
 *
 * ## Onde ela fica no caminho
 *
 *     com Partner       cria por API, na hora
 *     COM reserva       puxa uma pronta, na hora     <- mesmo resultado
 *     reserva vazia     e-mail para o dono, e a tela diz a verdade
 */

export type InstanciaDaReserva = { instanceId: string; token: string }

/**
 * Reserva a instância livre mais antiga para esta empresa.
 *
 * ## A atomicidade é da RPC, e não daqui
 *
 * `puxar_da_reserva` (0097) faz `for update skip locked` numa declaração só.
 * Ler a linha livre aqui e marcá-la depois reabriria a corrida que a RPC existe
 * para fechar: dois cliques no mesmo segundo receberiam a MESMA instância, e um
 * número de WhatsApp entregue a duas empresas põe a mensagem de um cliente na
 * caixa do outro.
 *
 * `null` quer dizer reserva vazia, e não falha. Quem chama trata como estado,
 * porque é o caso normal enquanto o dono não repõe.
 */
export async function puxarDaReserva(workspaceId: string): Promise<InstanciaDaReserva | null> {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('puxar_da_reserva', { p_workspace_id: workspaceId })

  if (error) {
    console.error('puxarDaReserva: falha ao chamar a RPC', error)
    return null
  }

  const linha = Array.isArray(data) ? data[0] : data
  if (!linha?.instance_id || !linha?.token_cifrado) return null

  try {
    return { instanceId: linha.instance_id, token: decifrar(linha.token_cifrado) }
  } catch (erro) {
    // Decifrar falhou: a chave mudou, ou a linha foi gravada errada. A
    // instância já está marcada como usada pela RPC e NÃO volta para a reserva
    // — entregá-la de novo depois de um erro que não foi diagnosticado é pior
    // que perder uma vaga, porque o próximo cliente receberia a mesma falha.
    console.error(
      `puxarDaReserva: instancia ${linha.instance_id} marcada como usada e NAO entregue, falha ao decifrar`,
      erro,
    )
    return null
  }
}

/** Quantas ainda esperam. Para a Central e para o alarme de reserva vazia. */
export async function contarReservaLivre(): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('whatsapp_reserva')
    .select('id', { count: 'exact', head: true })
    .is('usada_em', null)

  if (error) {
    console.error('contarReservaLivre: falha ao contar', error)
    // `-1` e não `0`: zero é uma resposta, e dizer "a reserva está vazia"
    // quando não se conseguiu contar manda o dono comprar o que talvez já
    // exista. `null` significa NÃO SEI, e a lição é de 30/08.
    return -1
  }

  return count ?? 0
}

/**
 * Guarda uma instância comprada à mão, para o próximo cliente.
 *
 * As credenciais são validadas com `GET /status` ANTES de gravar: uma linha com
 * token errado não falha agora, falha na cara do cliente que clicar em
 * Conectar, e nesse momento ninguém está olhando o painel da Z-API.
 */
export async function guardarNaReserva(params: {
  instanceId: string
  token: string
  observacao?: string
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  try {
    // Teto da Action (ver `orcamento-de-tempo.ts`): os 8s padrão mais a sessão
    // de dono e o `insert` encostavam nos ~10s da Netlify.
    await statusDaInstancia(
      { instanceId: params.instanceId, token: params.token },
      { timeoutMs: TIMEOUT_NA_ACTION_MS },
    )
  } catch (erro) {
    if (estourouOTempo(erro)) {
      console.error('guardarNaReserva: provedor nao respondeu a tempo', erro)
      return {
        ok: false,
        motivo: 'A Z-API demorou demais para responder. Tente de novo em instantes.',
      }
    }
    console.error('guardarNaReserva: credenciais recusadas pelo provedor', erro)
    return {
      ok: false,
      motivo: 'A Z-API não reconheceu este ID e token. Confira os dois no painel dela.',
    }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('whatsapp_reserva').insert({
    provider: 'zapi',
    instance_id: params.instanceId,
    token_cifrado: cifrar(params.token),
    observacao: params.observacao ?? null,
  })

  if (error) {
    // 23505 é `unique (instance_id)`: a mesma instância cadastrada duas vezes.
    // Acontece ao colar de novo depois de perder a tela, e não é erro de
    // verdade — mas avisar importa, senão o dono acha que tem duas em reserva
    // quando tem uma.
    if (error.code === '23505') {
      return { ok: false, motivo: 'Esta instância já está na reserva.' }
    }
    console.error('guardarNaReserva: falha ao gravar', error)
    return { ok: false, motivo: 'Não foi possível guardar na reserva.' }
  }

  return { ok: true }
}

/** O que a Central mostra: cada instância comprada e onde ela foi parar. */
export type LinhaDaReserva = {
  id: string
  instanceId: string
  observacao: string | null
  criadaEm: string
  usadaEm: string | null
  /** Nome da empresa que levou, quando já foi entregue. */
  entregueA: string | null
}

export async function lerReserva(): Promise<LinhaDaReserva[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_reserva')
    .select('id, instance_id, observacao, created_at, usada_em, usada_por')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('lerReserva: falha ao ler', error)
    return []
  }

  const linhas = data ?? []

  // O nome da empresa numa segunda ida, e não por junção: `workspaces` não tem
  // FK declarada a partir daqui no PostgREST em todos os casos, e uma lista de
  // no máximo cem linhas não justifica depender do formato da junção.
  const ids = Array.from(
    new Set(linhas.map((l) => l.usada_por).filter((i): i is string => Boolean(i))),
  )
  const nomes = new Map<string, string>()
  if (ids.length > 0) {
    const { data: empresas } = await admin.from('workspaces').select('id, name').in('id', ids)
    for (const e of empresas ?? []) nomes.set(e.id, e.name)
  }

  return linhas.map((l) => ({
    id: l.id,
    instanceId: l.instance_id,
    observacao: l.observacao,
    criadaEm: l.created_at,
    usadaEm: l.usada_em,
    entregueA: l.usada_por ? (nomes.get(l.usada_por) ?? 'empresa removida') : null,
  }))
}

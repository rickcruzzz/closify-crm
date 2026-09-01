import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Os dados da empresa que elevam o Event Match Quality da Meta.
 *
 * ## Por que uma consulta PRÓPRIA, e não ampliar a do layout
 *
 * `getCurrentUserAndWorkspace` roda em **toda navegação** do produto e traz
 * quatro colunas de propósito. Acrescentar cidade, estado, CEP e telefone ali
 * faria cada clique no menu pagar por dado que só três eventos por mês usam.
 *
 * A lição está registrada desde 12/08, quando `sincronizar_plano_do_workspace`
 * saiu do caminho quente: consulta de escrita rodando a cada navegação custava
 * ~700ms por tela.
 *
 * Aqui é o oposto — evento de conversão acontece uma vez por empresa, no
 * cadastro ou no checkout. Uma consulta a mais nesse ponto é irrelevante, e
 * evita onerar o que roda o tempo todo.
 *
 * ## Por que `createAdminClient`
 *
 * O evento é disparado do servidor, às vezes fora de uma sessão do usuário
 * (webhook do Asaas confirmando pagamento). RLS exigiria a sessão, que ali não
 * existe. A leitura é de uma empresa específica, por id, e só de campos que a
 * própria empresa cadastrou.
 */
export type DadosDeCorrespondencia = {
  nome: string | null
  telefone: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

const VAZIO: DadosDeCorrespondencia = {
  nome: null,
  telefone: null,
  cidade: null,
  estado: null,
  cep: null,
}

/**
 * Lê os campos de correspondência de uma empresa.
 *
 * **Nunca lança.** Um evento de conversão que falha por causa do enriquecimento
 * seria pior que um evento sem os campos extras: perderia também o e-mail e o
 * `external_id`, que são o que a Meta mais usa. Falhou, manda o básico.
 */
export async function dadosDeCorrespondencia(
  workspaceId: string | null | undefined,
): Promise<DadosDeCorrespondencia> {
  if (!workspaceId) return VAZIO

  try {
    const { data, error } = await createAdminClient()
      .from('workspaces')
      .select('name, telefone, cidade, estado, cep')
      .eq('id', workspaceId)
      .maybeSingle()

    if (error || !data) return VAZIO

    return {
      nome: data.name ?? null,
      telefone: data.telefone ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      cep: data.cep ?? null,
    }
  } catch {
    return VAZIO
  }
}

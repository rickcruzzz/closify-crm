import 'server-only'

import { cifrar, decifrar } from '@/lib/integrations/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { EstadoDaConexao } from '@/lib/plans/max'
import type { Instancia } from '@/lib/whatsapp/zapi'

/**
 * A conexão de WhatsApp da empresa: quem lê, quem escreve, e o que nunca sai.
 *
 * ## Duas portas, e a diferença é quem pode ver o quê
 *
 * `conexaoDaEmpresa` usa o client do USUÁRIO e devolve só o que a tela mostra.
 * A 0090 revoga `select` da tabela inteira para `authenticated` e concede de
 * volta nas colunas seguras, então nem uma consulta mal escrita alcança o
 * token: a defesa é do banco, não deste arquivo.
 *
 * `credenciaisDaEmpresa` e `instanciaPorSegredo` usam o admin client, decifram
 * e **nunca** devolvem nada para um componente. `server-only` faz o build
 * falhar se alguém tentar.
 *
 * ## O segredo do webhook é gerado aqui, e nunca lido de volta pela tela
 *
 * Ele é a identidade da empresa na entrada do webhook (ver o cabeçalho da
 * 0090). Quem o tiver escreve na caixa de entrada daquela empresa — é por isso
 * que ele fica fora dos grants de coluna, ao lado do token.
 */

/** 32 bytes em hex. Cabe numa URL sem escapar nada, e não é adivinhável. */
function segredoNovo(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type ConexaoNaTela = {
  estado: EstadoDaConexao
  telefone: string | null
  ultimoErro: string | null
  conectadaEm: string | null
  vistaEm: string | null
}

/** O que a tela de Configurações mostra. Sem nenhum segredo. */
export async function conexaoDaEmpresa(workspaceId: string): Promise<ConexaoNaTela> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('status, telefone, ultimo_erro, conectada_em, vista_em')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('conexaoDaEmpresa: falha ao ler', error)
    // `desconhecido` e não `desconectado`: falha de LEITURA não é desconexão.
    // Tratar as duas como a mesma coisa faria uma indisponibilidade do Supabase
    // virar "seu WhatsApp caiu" na tela de quem está com tudo funcionando.
    return {
      estado: 'desconhecido',
      telefone: null,
      ultimoErro: null,
      conectadaEm: null,
      vistaEm: null,
    }
  }

  if (!data) {
    return {
      estado: 'ausente',
      telefone: null,
      ultimoErro: null,
      conectadaEm: null,
      vistaEm: null,
    }
  }

  return {
    estado: data.status as EstadoDaConexao,
    telefone: data.telefone,
    ultimoErro: data.ultimo_erro,
    conectadaEm: data.conectada_em,
    vistaEm: data.vista_em,
  }
}

/** As credenciais decifradas, para chamar a Z-API. Nunca sai daqui para cima. */
export async function credenciaisDaEmpresa(
  workspaceId: string,
): Promise<Instancia | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_instances')
    .select('instance_id, token_cifrado')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('credenciaisDaEmpresa: falha ao ler', error)
    return null
  }
  if (!data) return null

  try {
    return { instanceId: data.instance_id, token: decifrar(data.token_cifrado) }
  } catch (erro) {
    // Chave trocada ou valor corrompido. Devolver `null` faz o envio falhar com
    // mensagem, em vez de derrubar a Server Action inteira com um stack trace
    // que não diz nada a quem está tentando responder um cliente.
    console.error('credenciaisDaEmpresa: falha ao decifrar', erro)
    return null
  }
}

export type InstanciaDoWebhook = {
  id: string
  workspaceId: string
  instanceId: string
}

/**
 * Qual empresa está por trás deste segredo de URL.
 *
 * **É a única resolução de empresa da entrada do webhook.** O `instanceId` do
 * payload nunca é usado para isso: ele vem de fora e é forjável, e resolver a
 * empresa por ele repetiria o defeito que fez `c52a718` remover a rota da
 * Evolution em 28/08.
 *
 * Devolve `null` para segredo desconhecido, e a rota responde 401.
 */
export async function instanciaPorSegredo(
  segredo: string,
): Promise<InstanciaDoWebhook | null> {
  // Um segredo com tamanho errado não precisa de ida ao banco, e recusar antes
  // evita que uma URL com lixo vire consulta.
  if (!/^[0-9a-f]{64}$/.test(segredo)) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_instances')
    .select('id, workspace_id, instance_id')
    .eq('segredo_do_webhook', segredo)
    .maybeSingle()

  if (error) {
    console.error('instanciaPorSegredo: falha ao ler', error)
    return null
  }
  if (!data) return null

  return { id: data.id, workspaceId: data.workspace_id, instanceId: data.instance_id }
}

/**
 * Grava a instância recém-criada no provedor.
 *
 * O `insert` passa pela trigger `whatsapp_instances_exige_max` (0090), que
 * recusa com `42501` se o Max não estiver vigente. `service_role` ignora RLS e
 * **não ignora trigger** — é a única barreira que existe neste caminho, porque
 * a escrita é pelo admin client.
 */
export async function guardarInstancia(params: {
  workspaceId: string
  /**
   * Qual transporte, e SEM valor padrão de propósito.
   *
   * Até a 0099 isto era `'zapi'` escrito fixo aqui. Dar a ele um padrão agora
   * faria o caminho novo gravar `zapi` no dia em que alguém esquecesse de
   * passá-lo, e a linha resultante seria lida por `escolherRemetente` como
   * Z-API: a mensagem sairia pelo transporte errado, com credencial que não
   * existe, e o sintoma seria envio falhando numa conexão que a tela diz
   * conectada.
   *
   * O `tsc` reclamando é mais barato que descobrir isso em produção.
   */
  provider: 'zapi' | 'evolution'
  instanceId: string
  token: string
  segredo: string
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const admin = createAdminClient()

  const { error } = await admin.from('whatsapp_instances').insert({
    workspace_id: params.workspaceId,
    provider: params.provider,
    instance_id: params.instanceId,
    token_cifrado: cifrar(params.token),
    segredo_do_webhook: params.segredo,
    status: 'conectando',
  })

  if (error) {
    // 42501 é a trigger de plano. A mensagem dela já é escrita para ser lida
    // pela pessoa, e repeti-la aqui criaria duas frases para a mesma regra.
    if (error.code === '42501') return { ok: false, motivo: error.message }
    // 23505 é `unique (workspace_id)`: já existe conexão nesta empresa. Pode
    // acontecer com dois cliques rápidos, e não é erro de verdade.
    if (error.code === '23505') {
      return { ok: false, motivo: 'Esta empresa já tem um WhatsApp conectado.' }
    }
    console.error('guardarInstancia: falha ao gravar', error)
    return { ok: false, motivo: 'Não foi possível guardar a conexão.' }
  }

  return { ok: true }
}

/** O segredo de uma conexão nova. Exportado para a Server Action gerar a URL. */
export { segredoNovo }

/**
 * Move o estado da conexão.
 *
 * Toda escrita de estado passa por aqui, e é o que impede duas telas de
 * contarem histórias diferentes. `vista_em` avança SEMPRE, mesmo quando o
 * estado não muda: é a prova de vida, e é ela que separa "está conectado" de
 * "achamos que está" — o mesmo desenho de `__ultima_varredura` no vigia.
 */
export async function registrarEstado(params: {
  workspaceId: string
  estado: Exclude<EstadoDaConexao, 'desconhecido'>
  telefone?: string | null
  erro?: string | null
}): Promise<{ anterior: EstadoDaConexao | null }> {
  const admin = createAdminClient()
  const agora = new Date().toISOString()

  // ## O estado ANTERIOR sai daqui, e é o que impede o sino de virar ruído
  //
  // Quem chama precisa saber se houve TRANSIÇÃO ou repetição. Uma conexão que
  // oscila manda vários `DisconnectedCallback` seguidos, e avisar em todos
  // encheria a fila com o mesmo fato — que é como uma fila deixa de ser olhada
  // (8 de 11 alertas eram ruído em 20/08).
  //
  // É a mesma regra do vigia de 01/09: varre sempre, avisa quando MUDA.
  //
  // O `select` extra custa uma ida, e ela acontece em webhook de desconexão —
  // raro por construção. Devolver do próprio `update` exigiria uma RPC.
  const { data: antes } = await admin
    .from('whatsapp_instances')
    .select('status')
    .eq('workspace_id', params.workspaceId)
    .maybeSingle()

  const { error } = await admin
    .from('whatsapp_instances')
    .update({
      status: params.estado,
      vista_em: agora,
      updated_at: agora,
      ...(params.telefone !== undefined ? { telefone: params.telefone } : {}),
      // O erro é LIMPO ao conectar. Sem isso a tela mostraria para sempre o
      // motivo da última queda ao lado de um número que voltou.
      ...(params.estado === 'conectado'
        ? { conectada_em: agora, ultimo_erro: null }
        : {}),
      ...(params.estado === 'desconectado' || params.estado === 'erro'
        ? { desconectada_em: agora, ultimo_erro: params.erro?.slice(0, 300) ?? null }
        : {}),
    })
    .eq('workspace_id', params.workspaceId)

  if (error) {
    // Não derruba quem chamou: os chamadores são webhooks, e um webhook que
    // lança vira 500, e 500 faz o provedor reentregar para sempre. Lição da
    // fila do Asaas.
    console.error('registrarEstado: falha ao gravar', error)
  }

  return { anterior: (antes?.status as EstadoDaConexao | undefined) ?? null }
}

/** Remove a linha. Só o caminho de desconectar de vez chama. */
export async function esquecerInstancia(workspaceId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('whatsapp_instances')
    .delete()
    .eq('workspace_id', workspaceId)
  if (error) console.error('esquecerInstancia: falha ao apagar', error)
}

/**
 * Qual transporte serve esta empresa.
 *
 * `null` quer dizer que não há conexão nenhuma, e quem chama trata isso como
 * estado e não como falha: é o caso de toda empresa que ainda não conectou.
 *
 * Lido por `escolherRemetente`, e é a razão pela qual `whatsapp_instances`
 * nasceu com a coluna `provider` na 0090 em vez de assumir Z-API.
 */
export async function provedorDaEmpresa(
  workspaceId: string,
): Promise<'zapi' | 'evolution' | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_instances')
    .select('provider')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    // Falha de leitura NÃO vira "não tem conexão": isso mandaria a tela dizer
    // que a empresa não conectou quando ela conectou, e a pessoa refaria o
    // pareamento por nada. `null` aqui significa não sei, e quem chama devolve
    // o remetente que recusa com mensagem.
    console.error('provedorDaEmpresa: falha ao ler', error)
    return null
  }

  const p = data?.provider
  return p === 'zapi' || p === 'evolution' ? p : null
}

/** As credenciais da instância Evolution desta empresa, já decifradas. */
export async function credenciaisEvolutionDaEmpresa(
  workspaceId: string,
): Promise<{ nome: string; token: string } | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_instances')
    .select('instance_id, token_cifrado, provider')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error || !data) return null
  // A conferência do provedor fica aqui e não em quem chama: uma empresa que
  // migrou de transporte tem a linha trocada, e mandar o token de um provedor
  // para o outro daria 401 com uma mensagem que não explica nada.
  if (data.provider !== 'evolution') return null

  try {
    return { nome: data.instance_id, token: decifrar(data.token_cifrado) }
  } catch (erro) {
    console.error('credenciaisEvolutionDaEmpresa: falha ao decifrar', erro)
    return null
  }
}

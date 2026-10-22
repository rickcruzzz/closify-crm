'use server'

import { revalidatePath } from 'next/cache'
import { z } from '@/lib/validations/zod'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { escolherRemetente } from '@/lib/conversas/remetente'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import { podeEnviarWhatsapp } from '@/lib/integrations/whatsapp-estado'
import { direitoAoWhatsapp } from '@/lib/plans/max'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { conexaoDaEmpresa } from '@/lib/whatsapp/instancia'

/**
 * Responder, assumir e arquivar conversa.
 *
 * Segue o molde de `lib/tasks/actions.ts`: parâmetro `unknown`, Zod primeiro,
 * sessão depois, conferência de empresa em toda escrita, retorno em união
 * `{ success } | { error }`.
 *
 * **Server Action é endpoint HTTP.** Dá para chamá-la sem passar pela tela, e
 * três defeitos deste projeto vieram de esquecer isso. Toda checagem abaixo
 * existe porque a interface não é barreira nenhuma.
 */

const idSchema = z.uuid('Conversa inválida.')

const textoSchema = z
  .string()
  .trim()
  .min(1, 'Escreva alguma coisa antes de enviar.')
  // O WhatsApp corta em 4096 e não avisa: a mensagem chega truncada do outro
  // lado sem ninguém saber. Recusar aqui é melhor que entregar pela metade.
  .max(4096, 'A mensagem passou de 4.096 caracteres, o limite do WhatsApp.')

type Sessao = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
}

async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  return { supabase, userId: user.id, workspaceId }
}

/** A conversa é desta empresa? Devolve o telefone do contato, ou o erro. */
async function conferirConversa(
  sessao: Sessao,
  conversaId: string,
): Promise<{ leadId: string; telefone: string | null } | { error: string }> {
  const { data, error } = await sessao.supabase
    .from('conversas')
    .select('lead_id, leads!inner(phone)')
    .eq('id', conversaId)
    .eq('workspace_id', sessao.workspaceId)
    .maybeSingle()

  if (error) {
    console.error('conferirConversa: falha ao ler', error)
    return { error: 'Não foi possível abrir a conversa.' }
  }
  if (!data) return { error: 'Conversa não encontrada.' }

  const lead = Array.isArray(data.leads) ? data.leads[0] : data.leads
  return { leadId: data.lead_id, telefone: lead?.phone ?? null }
}

function revalidar(leadId?: string) {
  revalidatePath('/conversas')
  revalidatePath('/hoje')
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

/**
 * Conclui a tarefa aberta de "Responder no WhatsApp" daquele contato.
 *
 * ## O defeito que isto fecha, visto num print com dado real
 *
 * A barra lateral dizia "Conversas 3" enquanto `/hoje` dizia 5. A pessoa tinha
 * respondido duas conversas, e o produto continuava cobrando as cinco.
 *
 * Lista que cobra o que ja foi feito treina a pessoa a ignorar a lista — a
 * mesma licao de `/dono/alertas`, onde 8 de 11 alertas eram ruido e o efeito
 * foi ninguem mais olhar. Num produto cuja promessa e nao perder venda por
 * esquecimento, matar a confianca em `/hoje` e o pior desfecho possivel.
 *
 * ## Por que nunca derruba quem chamou
 *
 * A mensagem ja saiu para o cliente quando esta funcao roda. Devolver erro aqui
 * faria a pessoa mandar de novo, achando que falhou. Registra alto e segue.
 *
 * Espelha em `activities` como `concluirTarefa` faz, para o historico do
 * contato registrar que a resposta aconteceu.
 */
async function concluirTarefaDeResposta(sessao: Sessao, leadId: string): Promise<void> {
  const { data: concluidas, error } = await sessao.supabase
    .from('tasks')
    .update({ done_at: new Date().toISOString() })
    .eq('workspace_id', sessao.workspaceId)
    .eq('lead_id', leadId)
    .eq('type', 'whatsapp')
    // `is('done_at', null)` e o que torna isto idempotente: responder duas
    // vezes nao gera duas atividades, porque a segunda nao casa com linha
    // nenhuma. Mesmo desenho de `concluirTarefa`.
    .is('done_at', null)
    .select('id, title, type, lead_id')

  if (error) {
    console.error('concluirTarefaDeResposta: falha ao concluir', error)
    return
  }

  for (const tarefa of concluidas ?? []) {
    const { error: erroAtividade } = await sessao.supabase.from('activities').insert({
      workspace_id: sessao.workspaceId,
      lead_id: leadId,
      author_id: sessao.userId,
      type: tarefa.type,
      description: tarefa.title,
    })
    if (erroAtividade) {
      console.error('concluirTarefaDeResposta: atividade nao registrada', erroAtividade)
    }
  }
}

/**
 * Envia uma mensagem e registra o envio.
 *
 * ## A ordem importa, e por quê
 *
 * A mensagem é gravada como `pendente` ANTES de sair, e só depois marcada
 * `enviada` ou `falhou`. Gravar depois perderia a mensagem se o processo
 * morresse no meio do envio — e o Evolution já teria entregado ao cliente,
 * então ela existiria no WhatsApp dele e não no nosso histórico.
 *
 * ## O teto de aquecimento
 *
 * `tierDaConexao` existia desde a integração e **nunca teve consumidor de
 * produção** (achado 2.2 do diagnóstico). É ele que limita quantas mensagens
 * saem por hora conforme a idade da conexão: 10/h na primeira semana, 20 até a
 * terceira, 30 depois.
 *
 * Sem ele, o envio sairia sem teto nenhum, que é o caminho mais rápido para a
 * Meta banir o número — desde janeiro/2026 ela detecta por cadência de
 * comportamento, não só por volume.
 */
export async function enviarMensagem(
  conversaId: unknown,
  texto: unknown,
  destinoEsperado?: { workspaceId: string; leadId: string; telefone: string },
): Promise<{ success: true } | { error: string }> {
  const idOk = idSchema.safeParse(conversaId)
  if (!idOk.success) return { error: 'Conversa inválida.' }

  const textoOk = textoSchema.safeParse(texto)
  if (!textoOk.success) {
    return { error: textoOk.error.issues[0]?.message ?? 'Mensagem inválida.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const alvo = await conferirConversa(sessao, idOk.data)
  if ('error' in alvo) return alvo

  // O Radar conserva o destino confirmado entre as duas Actions. Troca de
  // empresa em outra aba ou edição do telefone não pode trocar o destinatário.
  if (destinoEsperado !== undefined) {
    const destino = z.object({ workspaceId: idSchema, leadId: idSchema, telefone: z.string() }).safeParse(destinoEsperado)
    if (!destino.success || destino.data.workspaceId !== sessao.workspaceId ||
      destino.data.leadId !== alvo.leadId ||
      !normalizarTelefoneBrasileiro(destino.data.telefone) ||
      normalizarTelefoneBrasileiro(destino.data.telefone) !== normalizarTelefoneBrasileiro(alvo.telefone)) {
      return { error: 'O destinatário mudou. Volte ao evento e confira o contato antes de enviar.' }
    }
  }

  if (!alvo.telefone) {
    return { error: 'Este contato não tem telefone cadastrado.' }
  }

  // ## A migração é checada ANTES do plano, e a ordem é a correção
  //
  // Enquanto `FASE_DO_WHATSAPP` é 'migrando', ninguém envia por aqui — nem
  // Free, nem Pro. `escolherRemetente` devolve sempre `emMigracao`, cujo
  // `tetoPorHora()` é 0.
  //
  // O gate do plano vinha primeiro e mandava fazer upgrade: quem pagasse os
  // R$ 97 por causa dessa frase tentaria enviar e receberia "Limite de 0
  // mensagens por hora atingido". Cobrar por uma coisa que o produto não faz
  // é pior do que não ter a coisa.
  //
  // Quando a Cloud API voltar, esta guarda deixa de disparar sozinha — é o
  // que `FASE_DO_WHATSAPP` promete no próprio comentário — e o gate do Pro
  // abaixo volta a ser a única regra, sem nada para desfazer aqui.
  if (!podeEnviarWhatsapp()) {
    return {
      error:
        'O envio pelo WhatsApp está fora do ar enquanto trocamos de provedor. Use o botão de abrir o WhatsApp no contato.',
    }
  }

  // ## O gate mudou de PRO para MAX em 16/09, e a árvore virou uma só
  //
  // Antes eram dois `if` seguidos: `pro_vigente()` e depois
  // `integration_connections.status === 'connected'`. Cada um com a própria
  // frase, escrita no lugar onde foi precisa.
  //
  // Agora é `direitoAoWhatsapp`, que responde as duas perguntas de uma vez e
  // devolve QUAL das quatro negativas é. A razão está no cabeçalho de
  // `lib/plans/max.ts`: cada negativa pede uma ação diferente de quem lê, e um
  // `if` por chamador produz versões que divergem. A que diverge em silêncio é
  // a que manda cliente pagante para a tela de vendas.
  //
  // O WhatsApp é do Max e não do Pro porque cada empresa conectada consome uma
  // instância paga no provedor. É o único recurso deste produto cujo custo
  // marginal não é zero.
  const [assinatura, conexao] = await Promise.all([
    situacaoDoMax(sessao.workspaceId),
    conexaoDaEmpresa(sessao.workspaceId),
  ])

  const direito = direitoAoWhatsapp(assinatura, conexao.estado)
  if (!direito.pode) return { error: direito.motivo }

  // Qual transporte entrega a mensagem. Hoje Z-API, amanhã Cloud API: a troca
  // acontece dentro de `escolherRemetente`, e nada abaixo muda.
  const remetente = escolherRemetente(sessao.workspaceId)

  // `conectada_em` e não `created_at`: o aquecimento conta do dia em que o
  // NÚMERO foi pareado, não do dia em que a linha nasceu no banco. Uma empresa
  // que criou a conexão, desistiu, e voltou duas semanas depois teria o teto de
  // número maduro num número que acabou de entrar — e o número em risco é o
  // dela, não o nosso.
  const limite = await conferirTetoDeEnvio(sessao, remetente, conexao.conectadaEm)
  if (limite) return { error: limite }

  const numero = normalizarTelefoneBrasileiro(alvo.telefone) ?? alvo.telefone

  const { data: gravada, error: erroGravar } = await sessao.supabase
    .from('mensagens')
    .insert({
      workspace_id: sessao.workspaceId,
      conversa_id: idOk.data,
      direcao: 'enviada',
      tipo: 'texto',
      texto: textoOk.data,
      enviada_por: sessao.userId,
      status: 'pendente',
    })
    .select('id')
    .single()

  if (erroGravar || !gravada) {
    if (erroGravar?.code === '42501') return { error: erroGravar.message }
    console.error('enviarMensagem: falha ao gravar', erroGravar)
    return { error: 'Não foi possível registrar a mensagem.' }
  }

  const entrega = await remetente.enviarTexto(sessao.workspaceId, numero, textoOk.data)

  if (!entrega.ok) {
    // A linha fica, marcada como falha. Apagá-la esconderia da pessoa que ela
    // ACHOU que respondeu e não respondeu — que é pior que um X na tela.
    await sessao.supabase
      .from('mensagens')
      .update({ status: 'falhou', erro: entrega.motivo.slice(0, 300) })
      .eq('id', gravada.id)
      .eq('workspace_id', sessao.workspaceId)

    return { error: 'O WhatsApp não aceitou a mensagem. Ela ficou marcada como não enviada.' }
  }

  await sessao.supabase
    .from('mensagens')
    .update({ status: 'enviada', external_id: entrega.externalId })
    .eq('id', gravada.id)
    .eq('workspace_id', sessao.workspaceId)

  const agora = new Date().toISOString()
  const { error: erroConversa } = await sessao.supabase
    .from('conversas')
    .update({ ultimo_enviado_em: agora, respondida_em: agora })
    .eq('id', idOk.data)
    .eq('workspace_id', sessao.workspaceId)

  if (erroConversa) {
    // A mensagem saiu. Sem esta marca a conversa continua no topo como
    // "esperando", e a pessoa responde de novo achando que falhou.
    console.error('enviarMensagem: mensagem enviada mas a conversa não foi marcada', erroConversa)
  }

  await concluirTarefaDeResposta(sessao, alvo.leadId)

  revalidar(alvo.leadId)
  return { success: true }
}

/**
 * Quantas mensagens já saíram na última hora, contra o teto da idade da conexão.
 *
 * `count: exact, head: true`: o banco devolve o número, não as linhas.
 */
async function conferirTetoDeEnvio(
  sessao: Sessao,
  remetente: ReturnType<typeof escolherRemetente>,
  conectadoEm: string | null,
): Promise<string | null> {
  const teto = remetente.tetoPorHora(conectadoEm)
  // `null` = transporte sem teto proprio. E o que a Cloud API vai devolver: la
  // o controle e por nivel de qualidade, nao por cadencia de robo.
  if (teto === null) return null

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await sessao.supabase
    .from('mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', sessao.workspaceId)
    .eq('direcao', 'enviada')
    .gte('created_at', umaHoraAtras)

  if (error) {
    // Sem saber quantas saíram, não envia. Errar para o lado de segurar uma
    // mensagem é muito mais barato que errar para o lado de queimar o número.
    console.error('conferirTetoDeEnvio: falha ao contar', error)
    return 'Não foi possível conferir o limite de envio. Tente daqui a pouco.'
  }

  if ((count ?? 0) >= teto) {
    return (
      `Limite de ${teto} mensagens por hora atingido. ` +
      remetente.explicacaoDoTeto(conectadoEm)
    )
  }

  return null
}

/**
 * Assume a conversa, para os outros verem que alguém já está nela.
 *
 * Com três pessoas dividindo o atendimento, duas responderem o mesmo cliente é
 * o erro mais constrangedor possível diante dele. `assumida_em` expira em
 * minutos na leitura, então ninguém fica preso a uma conversa que abandonou.
 */
export async function assumirConversa(
  conversaId: unknown,
): Promise<{ success: true } | { error: string }> {
  const idOk = idSchema.safeParse(conversaId)
  if (!idOk.success) return { error: 'Conversa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const alvo = await conferirConversa(sessao, idOk.data)
  if ('error' in alvo) return alvo

  const { error } = await sessao.supabase
    .from('conversas')
    .update({ dono_id: sessao.userId, assumida_em: new Date().toISOString() })
    .eq('id', idOk.data)
    .eq('workspace_id', sessao.workspaceId)

  if (error) {
    console.error('assumirConversa: falha ao gravar', error)
    return { error: 'Não foi possível assumir a conversa.' }
  }

  revalidar(alvo.leadId)
  return { success: true }
}

/**
 * Arquiva a conversa: some da lista sem apagar nada.
 *
 * Não existe excluir. Apagar conversa é reescrever história com o cliente, e a
 * promessa deste produto é justamente que a empresa fica dona do histórico.
 */
export async function arquivarConversa(
  conversaId: unknown,
): Promise<{ success: true } | { error: string }> {
  const idOk = idSchema.safeParse(conversaId)
  if (!idOk.success) return { error: 'Conversa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const alvo = await conferirConversa(sessao, idOk.data)
  if ('error' in alvo) return alvo

  const { error } = await sessao.supabase
    .from('conversas')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('id', idOk.data)
    .eq('workspace_id', sessao.workspaceId)

  if (error) {
    console.error('arquivarConversa: falha ao gravar', error)
    return { error: 'Não foi possível arquivar a conversa.' }
  }

  revalidar(alvo.leadId)
  return { success: true }
}

/**
 * Marca como respondida sem enviar nada.
 *
 * Existe porque a pessoa pode ter respondido pelo celular — e vai continuar
 * respondendo pelo celular enquanto se acostuma com a tela. Sem isto, a
 * conversa ficaria eternamente no topo cobrando uma resposta que já foi dada, e
 * a lista perderia a confiança de quem a usa.
 */
export async function marcarComoRespondida(
  conversaId: unknown,
): Promise<{ success: true } | { error: string }> {
  const idOk = idSchema.safeParse(conversaId)
  if (!idOk.success) return { error: 'Conversa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const alvo = await conferirConversa(sessao, idOk.data)
  if ('error' in alvo) return alvo

  const { error } = await sessao.supabase
    .from('conversas')
    .update({ respondida_em: new Date().toISOString() })
    .eq('id', idOk.data)
    .eq('workspace_id', sessao.workspaceId)

  if (error) {
    console.error('marcarComoRespondida: falha ao gravar', error)
    return { error: 'Não foi possível marcar a conversa.' }
  }

  // "Já respondi pelo celular" precisa fechar a cobrança em `/hoje` tanto
  // quanto responder por aqui. Sem isto, quem usa o celular ficaria com a
  // tarefa aberta para sempre — e é justamente essa pessoa que a tela precisa
  // conquistar.
  await concluirTarefaDeResposta(sessao, alvo.leadId)

  revalidar(alvo.leadId)
  return { success: true }
}

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MensagemRecebida } from '@/lib/prospeccao/mensagem-recebida'
import { proximoStatusDeEntrega, type StatusDaMensagem } from '@/lib/whatsapp/entrega'

/**
 * A mensagem que chega vira conversa e contato, dentro da empresa certa.
 *
 * ## Este caminho NÃO é novo, e é por isso que ele é curto
 *
 * A rota da Evolution (12/09) já faz exatamente isto e foi provada 20 de 20
 * contra produção. O que muda aqui é só de onde vem a empresa: lá ela é
 * resolvida pelo NOME, porque prospecção não é multiempresa; aqui ela vem do
 * segredo da URL, resolvido antes de esta função ser chamada.
 *
 * A gravação em si é a mesma, e continua sendo UMA: `conversas` + `mensagens`
 * da 0056, com o `upsert` que o `unique (workspace_id, lead_id, canal)`
 * permite, e o `external_id` único por empresa que é a segunda camada de
 * dedupe.
 *
 * ## `fromMe` GRAVA, e é o que a prospecção não faz
 *
 * Lá a mensagem que sai é a abordagem voltando, e contá-la como resposta
 * marcaria o prospect como "respondeu" no segundo do disparo.
 *
 * Aqui é o contrário: `notifySentByMe` está ligado na instância de propósito, e
 * é o que faz a mensagem que o dono mandou **pelo celular** aparecer no CRM.
 * Sem isso a caixa mostraria as perguntas do cliente sem nenhuma resposta ao
 * lado, e a pessoa concluiria que o produto perdeu o que ela escreveu.
 *
 * A diferença aparece em `respondida_em`: mensagem nossa MARCA a conversa como
 * respondida, mensagem dele reabre a espera.
 */

export type ResultadoDaGravacao =
  | { ok: true; conversaId: string; leadId: string }
  | { ok: false; motivo: string }

/**
 * Já vimos este evento?
 *
 * Primeira das DUAS camadas de dedupe; a segunda é o índice único
 * `mensagens (workspace_id, external_id)` da 0056. As duas existem porque
 * respondem a coisas diferentes: esta barra o reenvio antes de qualquer
 * trabalho, aquela impede a linha duplicada mesmo se esta falhar.
 *
 * `insert` e não `select`-depois-`insert`: a corrida entre os dois deixaria
 * passar o reenvio que chega no mesmo instante, que é exatamente o caso.
 *
 * O prefixo separa deste espaço de nomes o da prospecção, que grava o id cru da
 * Evolution na mesma tabela. Sem ele, dois provedores que usem o mesmo formato
 * de id se calariam um ao outro.
 *
 * ## O prefixo era `zapi:` fixo, e virou o provedor de verdade
 *
 * Com a 0099 esta função passou a atender dois transportes, e a chave de uma
 * mensagem da Evolution saía escrita `zapi:`. Nada colidia — `instance_id` é
 * único por `(provider, instance_id)` —, e por isso o defeito era só uma mentira
 * na tabela. Mentira que a própria justificativa acima desmonta: um prefixo que
 * não distingue provedor não separa espaço de nomes nenhum.
 *
 * As chaves da Z-API NÃO mudam, porque os chamadores dela passam `'zapi'`.
 * Trocá-las faria todo evento já visto parecer novo, e a segunda camada
 * (`mensagens (workspace_id, external_id)`) é que pagaria a conta.
 */
export async function eventoNovo(
  supabase: ReturnType<typeof createAdminClient>,
  provider: 'zapi' | 'evolution',
  instanceId: string,
  eventoId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('whatsapp_webhook_events')
    .insert({ event_id: `${provider}:${instanceId}:${eventoId}` })

  if (error && error.code === '23505') return false
  if (error) {
    // Falha de banco não pode ser lida como "repetido": isso descartaria a
    // mensagem em silêncio, que é o desfecho mais caro deste caminho.
    console.error('eventoNovo: falha ao gravar dedupe', error)
    throw error
  }
  return true
}

/** Grava a mensagem na empresa dona da instância. */
export async function gravarMensagem(params: {
  workspaceId: string
  mensagem: MensagemRecebida
}): Promise<ResultadoDaGravacao> {
  const { workspaceId, mensagem } = params
  const supabase = createAdminClient()
  const agora = new Date().toISOString()
  const telefone = mensagem.telefone!

  // ## O contato, pelos últimos 8 dígitos
  //
  // A RPC da 0047 resolve no banco, com índice funcional. O código antigo
  // trazia TODOS os leads e comparava em JavaScript, O(n) por mensagem: com
  // 3.000 contatos, cada mensagem varria 3.000 linhas.
  const { data: achado, error: erroBusca } = await supabase.rpc(
    'encontrar_lead_por_telefone',
    { p_workspace_id: workspaceId, p_telefone: telefone },
  )
  if (erroBusca) {
    console.error('gravarMensagem: falha ao buscar o contato', erroBusca)
    return { ok: false, motivo: 'busca de contato falhou' }
  }

  let leadId = achado as string | null

  if (!leadId) {
    // ## Contato novo nasce, e isso é decisão de produto
    //
    // Quem escreve para o número da empresa vira contato. É o comportamento
    // certo: o cliente que chega pelo WhatsApp É um lead, e fazê-lo depender de
    // alguém cadastrar à mão devolve o produto ao problema que ele resolve.
    //
    // O custo é que a caixa terá gente que não é cliente. `leads.status` nasce
    // `novo`, e o funil é de quem trabalha a lista.
    const { data: criado, error: erroDeLead } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        name: (mensagem.nome ?? `+${telefone}`).slice(0, 120),
        // Nulo, e o contato continua válido: a 0025 exige e-mail OU telefone, e
        // quem chega por aqui chegou pelo telefone.
        email: null,
        phone: telefone,
        status: 'novo',
      })
      .select('id')
      .single()

    if (erroDeLead) {
      // 23505 é a dedupe por telefone da 0025 funcionando: outro contato já tem
      // este número, e a busca acima deveria tê-lo achado. Se não achou, o
      // formato difere o bastante para os 8 dígitos não casarem.
      //
      // 42501 é o limite de contatos do plano. Ele é REAL e precisa aparecer:
      // uma empresa no teto que recebe mensagem tem a mensagem descartada, e o
      // silêncio é o pior aviso possível.
      console.error('gravarMensagem: contato não criado', erroDeLead)
      return { ok: false, motivo: erroDeLead.code ?? 'contato não criado' }
    }
    leadId = criado.id
  }

  const { data: conversa, error: erroDeConversa } = await supabase
    .from('conversas')
    .upsert(
      {
        workspace_id: workspaceId,
        lead_id: leadId,
        canal: 'whatsapp',
        ...(mensagem.deNos
          ? // Nossa mensagem FECHA a espera. É o que faz o contador da barra
            // lateral cair quando o dono responde pelo celular, em vez de
            // cobrar para sempre uma conversa que ele já atendeu.
            { ultimo_enviado_em: agora, respondida_em: agora }
          : // `null` quer dizer ESPERANDO RESPOSTA, e é o que ordena a tela.
            // Toda mensagem recebida reabre a espera.
            { ultimo_recebido_em: agora, respondida_em: null }),
      },
      { onConflict: 'workspace_id,lead_id,canal' },
    )
    .select('id')
    .single()

  if (erroDeConversa) {
    console.error('gravarMensagem: falha na conversa', erroDeConversa)
    return { ok: false, motivo: 'conversa não gravada' }
  }

  const { error: erroDeMensagem } = await supabase.from('mensagens').insert({
    workspace_id: workspaceId,
    conversa_id: conversa.id,
    direcao: mensagem.deNos ? 'enviada' : 'recebida',
    tipo: mensagem.tipo,
    // A mensagem CRUA, antes de qualquer interpretação.
    texto: mensagem.texto,
    midia_chave: mensagem.midiaChave,
    midia_mime: mensagem.midiaMime,
    midia_segundos: mensagem.midiaSegundos,
    external_id: mensagem.id,
    // Mensagem que CHEGOU já está entregue por definição. `enviada` seria
    // mentira para a nossa que voltou pelo `notifySentByMe`: ela saiu do
    // celular e o WhatsApp já a entregou.
    status: mensagem.deNos ? 'enviada' : 'entregue',
  })

  // 23505 aqui quer dizer que a mensagem já estava gravada, e isso é sucesso.
  if (erroDeMensagem && erroDeMensagem.code !== '23505') {
    console.error('gravarMensagem: falha na mensagem', erroDeMensagem)
    return { ok: false, motivo: 'mensagem não gravada' }
  }

  return { ok: true, conversaId: conversa.id, leadId }
}

/**
 * Move o status de um lote de mensagens, sem nunca regredir.
 *
 * O WhatsApp confirma em lote: abrir uma conversa com dez mensagens não lidas
 * gera UM callback com dez ids. Por isso a leitura traz as linhas primeiro e
 * decide uma a uma — um `update` direto no lote gravaria o mesmo valor em
 * todas, inclusive nas que já estavam mais adiante na escada.
 */
export async function moverStatusDeEntrega(params: {
  workspaceId: string
  externalIds: string[]
  novo: StatusDaMensagem
}): Promise<number> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, status')
    .eq('workspace_id', params.workspaceId)
    .in('external_id', params.externalIds)

  if (error) {
    console.error('moverStatusDeEntrega: falha ao ler', error)
    return 0
  }

  let movidas = 0
  for (const linha of data ?? []) {
    const atual = linha.status as StatusDaMensagem
    const proximo = proximoStatusDeEntrega(atual, params.novo)
    // Só escreve quando MUDA. Um `update` que grava o mesmo valor gasta uma
    // ida de rede e ainda dispara qualquer trigger futura à toa.
    if (proximo === atual) continue

    const { error: erroUpdate } = await supabase
      .from('mensagens')
      .update({ status: proximo })
      .eq('id', linha.id)
      .eq('workspace_id', params.workspaceId)

    if (erroUpdate) {
      console.error('moverStatusDeEntrega: falha ao gravar', erroUpdate)
      continue
    }
    movidas += 1
  }

  return movidas
}

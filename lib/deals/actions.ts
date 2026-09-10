'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { canAddOrcamento } from '@/lib/limits'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { dealSchema } from '@/lib/validations/deal'
import { orcamentoSchema } from '@/lib/validations/orcamento'
import { prazoDoLembrete, tituloDoLembrete } from '@/lib/deals/orcamento'
import { uuidSchema } from '@/lib/validations/workspace'
import { dealStages, type DealStage } from '@/lib/deals/types'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Mesma resolução que as páginas usam para LER. Precisa ser a mesma: se a
  // tela mostra a empresa escolhida no seletor e a gravação cai na mais
  // antiga, o registro some da vista de quem acabou de criá-lo.
  return resolverWorkspaceAtivo(supabase, user.id)
}

async function isWorkspaceMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

export async function createDeal(values: unknown) {
  const parsed = dealSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  // lead_id não é validado pela RLS de deals (a policy só confere
  // workspace_id da linha), sem checar aqui, seria possível vincular um
  // deal a um lead de outro workspace, só sabendo o UUID.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', parsed.data.leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!lead) {
    return { error: 'Contato inválido.' }
  }

  const { error } = await supabase.from('deals').insert({
    workspace_id: workspaceId,
    lead_id: parsed.data.leadId,
    title: parsed.data.title,
    value: parsed.data.value,
    stage: parsed.data.stage,
    owner_id: parsed.data.ownerId,
    // String vazia viraria `''` na coluna `date` e o Postgres recusaria.
    // Prazo em branco é ausência de prazo, e `null` é como o banco (e a query
    // de "Próximos prazos", que filtra por `is not null`) já representa isso.
    due_date: parsed.data.dueDate || null,
  })

  if (error) {
    console.error('createDeal falhou', error)
    return { error: 'Não foi possível criar o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDealStage(dealId: string, stage: DealStage) {
  // Server Actions são endpoints HTTP expostos, o tipo DealStage só é
  // garantido em tempo de compilação para chamadas feitas pelo próprio
  // client gerado pelo Next. Uma requisição forjada direto ao endpoint
  // pode mandar qualquer string; sem essa checagem, o insert falharia só
  // na constraint do enum do Postgres, mas depois de já ter sido validado
  // contra RLS e workspace, gastando uma query à toa.
  if (!dealStages.includes(stage)) {
    return { error: 'Etapa inválida.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('deals')
    .update({ stage })
    .eq('id', dealId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('updateDealStage falhou', error)
    return { error: 'Não foi possível mover o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Exclui um negócio do workspace ativo.
 *
 * Faltava: até aqui um negócio criado por engano só podia mudar de etapa,
 * ficava no funil para sempre, inflando o valor do pipeline no dashboard.
 *
 * `.eq('workspace_id')` junto do `.eq('id')` não é redundância com a RLS: a
 * policy garante que ninguém apague de outra empresa, e esta cláusula garante
 * que a exclusão aconteça no workspace ATIVO da sessão, para quem participa de
 * mais de um.
 */
export async function deleteDeal(dealId: unknown) {
  const parsed = uuidSchema.safeParse(dealId)
  if (!parsed.success) {
    return { error: 'Negócio inválido.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', parsed.data)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteDeal falhou', error)
    return { error: 'Não foi possível excluir o negócio.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * O orçamento de um negócio, sob demanda.
 *
 * ## Por que não vem junto do board
 *
 * `getBoardDeals` é RPC e carrega todo card de todas as etapas. Pendurar
 * `orcamento_descricao` ali sairia caro por um motivo já medido nesta base: o
 * `/kanban` carrega os negócios abertos de uma vez, e trocar as 8 colunas de
 * `TaskRow` pelas 5 que o card usa derrubou a consulta de 315 B para 198 B por
 * negócio. A descrição aceita 2.000 caracteres — dez vezes o card inteiro,
 * numa tela que não a mostra.
 *
 * Então ela é lida só quando alguém abre o editor de orçamento, que é onde ela
 * aparece. Uma ida à rede, no clique que a pede.
 */
export async function lerOrcamento(dealId: unknown) {
  const parsed = uuidSchema.safeParse(dealId)
  if (!parsed.success) return { error: 'Negócio inválido.' }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  const { data, error } = await supabase
    .from('deals')
    .select('value, orcamento_validade, orcamento_descricao')
    .eq('id', parsed.data)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('lerOrcamento falhou', error)
    return { error: 'Não foi possível carregar o orçamento.' }
  }
  if (!data) return { error: 'Negócio não encontrado.' }

  return {
    orcamento: {
      valor: Number(data.value),
      validade: data.orcamento_validade,
      descricao: data.orcamento_descricao,
    },
  }
}

/**
 * Registra (ou tira) o orçamento de um negócio, e sincroniza a cobrança.
 *
 * ## O que isto entrega, e por que é o recurso e não um campo
 *
 * Guardar `valor + validade + o que foi proposto` é a metade fácil. A metade
 * que o mercado não tem é a segunda: quando a validade entra, nasce a tarefa
 * de cobrar retorno, e ela aparece em `/hoje` sozinha. Medido em 56
 * concorrentes que anunciam proposta (07/09/2026): 4% guardam validade, e
 * **0% avisam**.
 *
 * ## NÃO move a etapa do negócio, e isso é decisão
 *
 * O reflexo é empurrar para `proposta_enviada` ao registrar o orçamento. Seria
 * errado para quem já está em `negociacao`: a etapa andaria para TRÁS e
 * `stage_changed_at` (0033) seria rezerado — e é ele que alimenta o filtro
 * "Parados" do Kanban. Um negócio em negociação ativa passaria a parecer
 * recém-proposto, e o filtro que existe para achar negócio esquecido perderia
 * justamente o que estava andando.
 *
 * ## A ordem das escritas, e o que ela protege
 *
 * A tarefa é criada ANTES do negócio ser atualizado, porque o `id` dela
 * precisa entrar no mesmo `update`. Se o update do negócio falhar, a tarefa
 * recém-criada é apagada — senão sobraria uma cobrança órfã em `/hoje`, sem
 * orçamento nenhum por trás, que é pior que não ter cobrado.
 */
export async function registrarOrcamento(values: unknown) {
  const parsed = orcamentoSchema.safeParse(values)
  if (!parsed.success) {
    // A mensagem do campo, e não "Dados inválidos": o formulário tem quatro
    // campos e o genérico obriga a pessoa a adivinhar qual recusou.
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  // `.eq('workspace_id')` junto do `.eq('id')` não é redundância com a RLS: a
  // policy garante que ninguém leia de outra empresa, e esta cláusula garante
  // que a escrita caia no workspace ATIVO de quem participa de mais de um.
  const { data: negocio } = await supabase
    .from('deals')
    .select('id, title, lead_id, owner_id, orcamento_tarefa_id, orcamento_validade')
    .eq('id', parsed.data.dealId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!negocio) return { error: 'Negócio não encontrado.' }

  const validade = parsed.data.validade || null
  const descricao = parsed.data.descricao?.trim() || null

  // O teto do Free só morde quando a validade NASCE, exatamente como a trigger
  // da 0079 — negócio que já era orçamento pode ter a data corrigida sem
  // consumir vaga nova. As duas condições precisam casar: se a tela recusasse
  // onde o banco aceita, a pessoa veria uma parede que não existe.
  //
  // A trigger é quem de fato recusa. Esta checagem existe para a mensagem
  // chegar antes da tentativa, e para não criar a tarefa de lembrete logo
  // abaixo e depois ter que desfazê-la quando o insert do negócio falhasse.
  if (validade && !negocio.orcamento_validade) {
    const cabe = await canAddOrcamento(workspaceId)
    if (!cabe.allowed) return { error: cabe.reason }
  }

  let tarefaId: string | null = negocio.orcamento_tarefa_id
  let tarefaCriadaAgora: string | null = null

  if (validade) {
    const vence = prazoDoLembrete(validade, new Date())
    const titulo = tituloDoLembrete(negocio.title)

    if (tarefaId) {
      // `.select()` no update NÃO é enfeite: um PATCH que não casa com nenhuma
      // linha devolve 204, e **204 é sucesso**. Esta base já deu uma prova de
      // constraint como aprovada por causa disso. Sem ler a linha de volta,
      // uma tarefa apagada por fora deixaria o negócio apontando para um id
      // morto e a cobrança nunca mais seria recriada.
      //
      // `done_at: null` reabre a cobrança: quem concluiu "cobrar retorno" e
      // depois esticou a validade quer ser cobrado de novo — a tarefa
      // concluída é sobre o prazo ANTIGO.
      const { data: atualizada } = await supabase
        .from('tasks')
        .update({ title: titulo, due_at: vence, done_at: null })
        .eq('id', tarefaId)
        .eq('workspace_id', workspaceId)
        .select('id')
        .maybeSingle()

      if (!atualizada) tarefaId = null
    }

    if (!tarefaId) {
      const { data: nova, error } = await supabase
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          lead_id: negocio.lead_id,
          deal_id: negocio.id,
          // Vai para quem é dono do negócio, não para quem clicou: quem
          // registra o orçamento pode ser o admin, e a cobrança é de quem
          // conduz a venda.
          assignee_id: negocio.owner_id,
          created_by: user.id,
          title: titulo,
          // `whatsapp` porque é assim que a PME de serviço brasileira cobra
          // retorno — 82% vende por lá, e é o canal que a própria mensagem de
          // prospecção deste projeto usa. O tipo é aceito por `taskSchema`
          // (embora não seja oferecido no seletor), então a pessoa consegue
          // editar prazo e responsável desta tarefa normalmente.
          type: 'whatsapp',
          due_at: vence,
        })
        .select('id')
        .single()

      if (error || !nova) {
        console.error('registrarOrcamento: tarefa de retorno falhou', error)
        return { error: 'Não foi possível agendar a cobrança do retorno.' }
      }

      tarefaId = nova.id
      tarefaCriadaAgora = nova.id
    }
  } else if (tarefaId) {
    // Tirar o orçamento tira a cobrança junto. Deixá-la viva faria `/hoje`
    // cobrar retorno de um orçamento que não existe mais, e é assim que uma
    // fila de tarefas vira ruído que a pessoa aprende a ignorar — a lição de
    // 20/08, quando 8 dos 11 alertas da Central eram lixo.
    await supabase.from('tasks').delete().eq('id', tarefaId).eq('workspace_id', workspaceId)
    tarefaId = null
  }

  const { error } = await supabase
    .from('deals')
    .update({
      value: parsed.data.valor,
      orcamento_validade: validade,
      orcamento_descricao: descricao,
      orcamento_tarefa_id: tarefaId,
    })
    .eq('id', negocio.id)
    .eq('workspace_id', workspaceId)

  if (error) {
    if (tarefaCriadaAgora) {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', tarefaCriadaAgora)
        .eq('workspace_id', workspaceId)
    }

    console.error('registrarOrcamento falhou', error)
    return { error: 'Não foi possível salvar o orçamento.' }
  }

  revalidatePath('/kanban')
  revalidatePath('/hoje')
  revalidatePath('/dashboard')
  revalidatePath('/calendario')
  return { success: true }
}

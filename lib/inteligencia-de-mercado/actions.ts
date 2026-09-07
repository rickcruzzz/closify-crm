'use server'

import { revalidatePath } from 'next/cache'

import { excedeuLimite } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { uuidSchema } from '@/lib/validations/workspace'

/**
 * O gatilho do enriquecimento: marca um lead como `pendente` e RETORNA.
 *
 * Sem esta ação, `enriquecimento_de_lead` fica vazia para sempre no caminho de
 * produto — a fila (0072), o serviço e o cron existem desde 06/09 e ninguém
 * nunca teve como pôr um lead dentro deles pela tela. A prospecção interna
 * enfileira por script, com `service_role`; isto aqui é a outra ponta.
 *
 * ## Nada de rede no caminho da pessoa
 *
 * A ação **não chama o Exa**. Escreve uma linha e volta. A consulta acontece no
 * `/api/cron/enriquecer-leads`, a cada 15 minutos.
 *
 * A razão é a mesma de sempre aqui: uma chamada externa dentro do clique
 * transforma indisponibilidade de terceiro em erro na cara do cliente, e o Exa
 * é o terceiro mais novo desta base. Assíncrono, a pior falha é o sinal
 * demorar; síncrono, a pior falha é a tela quebrar.
 *
 * ## Por que Pro, e por que `pro_vigente()` e não a coluna
 *
 * Cada enriquecimento custa dinheiro de verdade (US$ 0,007 por consulta). Free
 * consumindo API paga é exatamente o buraco que as migrations 0019 a 0027
 * fecharam para o resto do produto, uma de cada vez.
 *
 * E a checagem lê a FUNÇÃO, nunca `workspaces.plan`: a coluna é o último valor
 * gravado e não sabe que o tempo passou. Pro vencido ontem tem `plan = 'pro'` e
 * `pro_vigente() = false` — a armadilha que a 0028 já pagou no aceite de
 * convite.
 *
 * ## O que esta ação NÃO faz, e é decisão
 *
 * Não enfileira em lote. Uma tela com "enriquecer todos os 500 leads" viraria
 * R$ 20 num clique, sem a pessoa ter visto um resultado sequer. Um lead por
 * vez, com o teto mensal de `dominio/orcamento.ts` por trás.
 */

type Resultado = { ok: true; jaEstava: boolean } | { ok: false; erro: string }

export async function enfileirarEnriquecimento(leadId: string): Promise<Resultado> {
  const id = uuidSchema.safeParse(leadId)
  if (!id.success) return { ok: false, erro: 'Contato inválido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { ok: false, erro: 'Nenhuma empresa ativa.' }

  // Teto por PESSOA e não por empresa: o custo é da conta do produto, e duas
  // pessoas da mesma empresa gastando em paralelo somam. Identificador é o
  // usuário porque é ele que aperta o botão.
  if (await excedeuLimite('enriquecer-lead', user.id)) {
    return { ok: false, erro: 'Muitos pedidos seguidos. Tente daqui a pouco.' }
  }

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })
  if (!pro) {
    return {
      ok: false,
      erro: 'Pesquisa de mercado é um recurso Pro. Faça upgrade para usar.',
    }
  }

  // O lead precisa ser DESTA empresa. A RLS de `leads` já isola por workspace,
  // então um id de fora simplesmente não é encontrado — mas conferir aqui é o
  // que permite devolver mensagem em vez de gravar uma linha órfã apontando
  // para um lead que a pessoa não pode ver.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', id.data)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!lead) return { ok: false, erro: 'Contato não encontrado.' }

  // `unique (lead_id)` na 0072 faz o segundo pedido colidir. Ler antes e
  // devolver `jaEstava` é o que evita a tela dizer "erro" para quem só clicou
  // duas vezes.
  const { data: existente } = await supabase
    .from('enriquecimento_de_lead')
    .select('status')
    .eq('lead_id', id.data)
    .maybeSingle()

  if (existente) {
    return { ok: true, jaEstava: true }
  }

  const { error } = await supabase
    .from('enriquecimento_de_lead')
    .insert({ workspace_id: workspaceId, lead_id: id.data, status: 'pendente' })

  // Checar `error` e não só o `catch`: o supabase-js NÃO lança em falha de RLS
  // ou de constraint, devolve `{ error }`. Foi assim que um `activities.insert`
  // engoliu mensagem de WhatsApp em 24/08.
  if (error) {
    // Corrida: dois cliques quase simultâneos passam os dois pelo `select` e o
    // segundo bate no `unique`. Isso não é falha para quem clicou.
    if (error.code === '23505') return { ok: true, jaEstava: true }
    return { ok: false, erro: 'Não foi possível pedir a pesquisa agora.' }
  }

  revalidatePath(`/leads/${id.data}`)
  return { ok: true, jaEstava: false }
}

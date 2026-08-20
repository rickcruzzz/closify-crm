'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { aplicarEventoAsaas } from '@/lib/asaas/aplicar-evento'
import { buscarPagamentoMaisRecente } from '@/lib/asaas/status-real'

import { registrarNoDiario } from './diario'
import { reexibir, reexibirTudo, silenciar } from './silenciados'
import { exigirAmbienteLocal } from './somente-local'

export type ResultadoDaAcao = { ok: true; mensagem: string } | { ok: false; erro: string }

/** Para de mostrar um alerta específico. Reversível — ver `silenciados.ts`. */
export async function silenciarAlerta(id: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()
  await silenciar(id)
  revalidatePath('/dono')
  revalidatePath('/dono/alertas')
  return { ok: true, mensagem: 'Alerta silenciado.' }
}

export async function reexibirAlerta(id: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()
  await reexibir(id)
  revalidatePath('/dono')
  revalidatePath('/dono/alertas')
  return { ok: true, mensagem: 'Alerta de volta.' }
}

export async function reexibirTodosOsAlertas(): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()
  await reexibirTudo()
  revalidatePath('/dono')
  revalidatePath('/dono/alertas')
  return { ok: true, mensagem: 'Todos os alertas voltaram.' }
}

/**
 * Pergunta ao Asaas qual é o status real da assinatura e aplica no banco.
 *
 * ## Por que reusar `aplicarEventoAsaas` em vez de escrever o status direto
 *
 * Porque aplicar um status não é um UPDATE: é dedupe, mais a RPC atômica que
 * mexe em `subscriptions` e `workspaces` na mesma transação, mais o e-mail que
 * a pessoa espera receber, mais a conversão enviada à Meta. Essa cadeia já
 * existe e já é compartilhada entre o webhook e o cron diário exatamente para
 * não divergir (ver o cabeçalho de `lib/asaas/aplicar-evento.ts`). Uma terceira
 * cópia aqui divergiria na primeira mudança.
 *
 * O `eventId` carrega o instante porque a dedupe é por evento: uma correção
 * manual precisa poder ser repetida se a primeira não resolveu, o que um id
 * fixo impediria para sempre.
 */
export async function consertarAssinatura(subscriptionId: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const pagamento = await buscarPagamentoMaisRecente(subscriptionId)

  if (!pagamento) {
    return {
      ok: false,
      erro: 'O Asaas não devolveu nenhum pagamento para essa assinatura. Sem pagamento não dá para saber o status real.',
    }
  }

  if (!pagamento.statusMapeado) {
    return {
      ok: false,
      erro: 'O pagamento mais recente está num estado que não corresponde a ativo, atrasado nem cancelado. Melhor olhar no painel do Asaas antes de mexer.',
    }
  }

  const supabase = createAdminClient()
  const resultado = await aplicarEventoAsaas({
    supabase,
    status: pagamento.statusMapeado,
    subscriptionId,
    eventId: `central-do-dono:${subscriptionId}:${Date.now()}`,
    eventType: 'CORRECAO_MANUAL',
    billingType: pagamento.billingType,
    origem: 'central-do-dono',
  })

  if (!resultado.ok) {
    return { ok: false, erro: 'A correção falhou. O erro completo está no terminal.' }
  }

  await registrarNoDiario('consertar-assinatura', {
    subscriptionId,
    statusAplicado: pagamento.statusMapeado,
    encontrouLinha: resultado.matched,
  })

  revalidatePath('/dono')

  if (!resultado.matched) {
    return {
      ok: false,
      erro: `O status real é "${pagamento.statusMapeado}", mas não existe nenhuma linha no banco com essa assinatura para atualizar. Provavelmente a pessoa assinou por fora do fluxo do produto.`,
    }
  }

  return { ok: true, mensagem: `Assinatura corrigida para "${pagamento.statusMapeado}".` }
}

/** Trinta dias em milissegundos. */
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000

/**
 * Dá Pro por 30 dias sem ninguém pagar.
 *
 * ## Por que escrita direta em vez da RPC do webhook
 *
 * `apply_asaas_subscription_status` procura a linha pelo `asaas_subscription_id`
 * e é o caminho por onde passa o dinheiro de verdade. Cortesia não tem
 * assinatura no Asaas, então usá-la exigiria inventar um id — que é exatamente
 * como nasceu a `sub_teste_local_...` que hoje dá Pro de graça em produção sem
 * ninguém saber. Aqui o registro fica explícito no `.dono-registro.jsonl` e o
 * `asaas_subscription_id` continua nulo, que é a verdade: não há assinatura.
 *
 * A trigger `proteger_colunas_do_workspace()` (migration 0022) só deixa a
 * service role subir `plan`, então esta escrita funciona e continua sendo a
 * única porta — a regra do banco não foi enfraquecida para isso existir.
 */
export async function liberarProDeCortesia(workspaceId: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()
  const venceEm = new Date(Date.now() + TRINTA_DIAS).toISOString()

  const { error: erroDaAssinatura } = await supabase.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      status: 'active',
      current_period_end: venceEm,
    },
    { onConflict: 'workspace_id' },
  )

  if (erroDaAssinatura) {
    return { ok: false, erro: `Não consegui gravar a assinatura: ${erroDaAssinatura.message}` }
  }

  const { error: erroDoPlano } = await supabase
    .from('workspaces')
    .update({ plan: 'pro' })
    .eq('id', workspaceId)

  if (erroDoPlano) {
    return { ok: false, erro: `Assinatura gravada, mas o plano não subiu: ${erroDoPlano.message}` }
  }

  await registrarNoDiario('liberar-pro-de-cortesia', { workspaceId, venceEm })
  revalidatePath('/dono')

  return {
    ok: true,
    mensagem: `Pro liberado até ${new Date(venceEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
  }
}

/** Tira o Pro e devolve a empresa ao plano gratuito. */
export async function voltarParaGratis(workspaceId: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()

  // `current_period_end: null` junto do status: `pro_vigente()` (migration
  // 0044) trata data nula como vencido, então zerar aqui fecha a porta mesmo
  // que alguém releia só a assinatura sem olhar o status.
  const { error: erroDaAssinatura } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', current_period_end: null })
    .eq('workspace_id', workspaceId)

  if (erroDaAssinatura) {
    return { ok: false, erro: `Não consegui cancelar a assinatura: ${erroDaAssinatura.message}` }
  }

  const { error: erroDoPlano } = await supabase
    .from('workspaces')
    .update({ plan: 'free' })
    .eq('id', workspaceId)

  if (erroDoPlano) {
    return { ok: false, erro: `Assinatura cancelada, mas o plano não desceu: ${erroDoPlano.message}` }
  }

  await registrarNoDiario('voltar-para-gratis', { workspaceId })
  revalidatePath('/dono')

  return { ok: true, mensagem: 'Empresa voltou para o plano gratuito.' }
}

/**
 * Apaga uma empresa e tudo que pende dela.
 *
 * ## A proteção, e por que ela é assim
 *
 * O nome digitado precisa bater exatamente com o nome da empresa. É o padrão do
 * GitHub para exclusão de repositório, e existe por um motivo específico: um
 * diálogo de "tem certeza?" é respondido no reflexo, digitar o nome exige ler o
 * que está prestes a ser apagado.
 *
 * A conferência acontece no SERVIDOR, não só no diálogo. Validação que só vive
 * no cliente não é validação — doutrina que este projeto já pagou três vezes
 * (migrations 0019, 0023 e 0024).
 *
 * As chaves estrangeiras cuidam da cascata: contatos, negócios, tarefas,
 * atividades, convites, integrações e a assinatura vão junto. Não há volta.
 */
export async function apagarEmpresa(
  workspaceId: string,
  nomeDigitado: string,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()

  const { data: empresa, error: erroDaBusca } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

  if (erroDaBusca || !empresa) {
    return { ok: false, erro: 'Não encontrei essa empresa. Talvez já tenha sido apagada.' }
  }

  if (nomeDigitado.trim() !== empresa.name) {
    return {
      ok: false,
      erro: 'O nome digitado não bate com o nome da empresa. Nada foi apagado.',
    }
  }

  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)

  if (error) {
    return { ok: false, erro: `Não consegui apagar: ${error.message}` }
  }

  // Registrado com o nome, não só o id: depois de apagada, o id não permite
  // mais descobrir de quem era.
  await registrarNoDiario('apagar-empresa', { workspaceId, nome: empresa.name })
  revalidatePath('/dono')

  return { ok: true, mensagem: `"${empresa.name}" foi apagada.` }
}

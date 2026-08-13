'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import {
  lerAtribuicaoUtm,
  lerConvitePendente,
  lerPlanoDesejado,
  limparIntencao,
} from '@/lib/auth/intencao'
import { registrar } from '@/lib/onboarding/eventos'
import { passoDoOnboardingSchema } from '@/lib/validations/onboarding'
import { FREE_WORKSPACE_LIMIT } from '@/lib/plans'
import type { OnboardingEtapa, OnboardingStatus, TourStatus } from '@/types/supabase'

type Sessao = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }

async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão expirada.' }
  return { supabase, userId: user.id }
}

/**
 * Grava o estado sem apagar o que já estava lá.
 *
 * `upsert` e não `insert`: a linha pode existir (backfill da 0030) ou não
 * (conta criada depois). Os dois caminhos precisam funcionar, e descobrir qual
 * é o caso antes de escrever custaria uma consulta a cada passo.
 */
async function gravarEstado(
  sessao: Sessao,
  campos: {
    status?: OnboardingStatus
    etapa?: OnboardingEtapa | null
    tour_status?: TourStatus
    checklist_oculto?: boolean
  },
) {
  const { error } = await sessao.supabase
    .from('onboarding_state')
    .upsert({ user_id: sessao.userId, ...campos }, { onConflict: 'user_id' })

  if (error) {
    console.error('gravarEstado do onboarding falhou', error)
    return { error: 'Não foi possível salvar seu progresso. Tente novamente.' }
  }

  return { success: true as const }
}

/** Marca o início. Chamado pelo botão "Começar configuração". */
export async function iniciarOnboarding() {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const r = await gravarEstado(sessao, { status: 'in_progress', etapa: 'empresa' })
  if ('error' in r) return r

  registrar('onboarding_started')
  return { success: true, etapa: 'empresa' as OnboardingEtapa }
}

/**
 * Salva um passo e devolve onde a pessoa deve estar agora.
 *
 * Cada passo grava ANTES de avançar. É o que faz a retomada funcionar: fechou
 * o navegador no meio, volta na etapa certa em vez de recomeçar — e o §15 do
 * pedido é justamente esse.
 *
 * A empresa só é tocada na etapa final, não a cada passo. A RPC é idempotente
 * (chamá-la três vezes deixa uma empresa só, provado em produção), mas chamar
 * a cada clique gastaria escrita à toa.
 */
export async function salvarPasso(values: unknown) {
  const parsed = passoDoOnboardingSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { etapa, nomeEmpresa, segmento, modeloVenda, tamanhoEquipe } = parsed.data

  // As respostas ficam no `jsonb` até a etapa de processamento. Se a pessoa
  // desistir no meio, nada foi escrito na empresa — e uma empresa com nome
  // preenchido e mais nada seria pior do que empresa nenhuma.
  const { error: erroResposta } = await sessao.supabase.from('onboarding_state').upsert(
    {
      user_id: sessao.userId,
      status: 'in_progress',
      etapa,
      respostas: {
        ...(nomeEmpresa ? { nomeEmpresa } : {}),
        ...(segmento ? { segmento } : {}),
        ...(modeloVenda ? { modeloVenda } : {}),
        ...(tamanhoEquipe ? { tamanhoEquipe } : {}),
      },
    },
    { onConflict: 'user_id' },
  )

  if (erroResposta) {
    console.error('salvarPasso falhou', erroResposta)
    return { error: 'Não foi possível salvar suas informações. Tente novamente.' }
  }

  if (segmento) registrar('onboarding_segment_selected', { segmento })

  return { success: true }
}

const finalizarSchema = z.object({
  nomeEmpresa: z.string().trim().min(2, 'Informe o nome da empresa.').max(80),
  segmento: z.string().trim().max(40).optional(),
  modeloVenda: z.enum(['servicos', 'produtos', 'ambos']).optional(),
  tamanhoEquipe: z.enum(['so_eu', '2_5', '6_20', '21_mais']).optional(),
})

/**
 * A etapa de processamento: garante a empresa e fecha o onboarding.
 *
 * Trabalho real, sem espera artificial. Se a RPC responder em 300 ms, a tela
 * avança em 300 ms — o pedido é explícito quanto a isso, e barra de progresso
 * fingida é o tipo de coisa que faz um produto parecer amador na segunda vez
 * que a pessoa vê.
 */
export async function finalizarOnboarding(values: unknown) {
  const parsed = finalizarSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  // Quem chegou por convite NÃO cria empresa própria.
  //
  // Esta guarda existe em `createWorkspace` desde o commit 3779d72, e o
  // onboarding é um caminho novo até a mesma criação — sem repeti-la aqui, o
  // defeito voltaria por outra porta: a pessoa convidada terminaria o
  // assistente com uma empresa só dela, o convite ficaria `pending` para
  // sempre, e como o workspace ativo é o MAIS ANTIGO ela cairia na empresa
  // errada depois de aceitar.
  const convitePendente = await lerConvitePendente()
  if (convitePendente) {
    const { data: convite } = await sessao.supabase.rpc('get_invite_by_token', {
      invite_token: convitePendente,
    })

    if (convite?.[0]?.status === 'pending') {
      return { error: 'convite_pendente' as const, destino: `/convite/${convitePendente}` }
    }

    // Convite já usado: o cookie é lixo e ficaria desviando para sempre.
    // Numa Server Action dá para apagá-lo; na renderização de página, não.
    await limparIntencao(['convite'])
  }

  const { nomeEmpresa, segmento, modeloVenda, tamanhoEquipe } = parsed.data

  const { data: workspaceId, error } = await sessao.supabase.rpc(
    'garantir_workspace_do_onboarding',
    {
      p_nome: nomeEmpresa,
      p_segmento: segmento ?? null,
      p_modelo_venda: modeloVenda ?? null,
      p_tamanho_equipe: tamanhoEquipe ?? null,
    },
  )

  if (error) {
    console.error('garantir_workspace_do_onboarding falhou', error)

    // Mensagem levantada de propósito pela RPC de criação (0018); é segura de
    // mostrar, ao contrário do texto cru do Postgres.
    if (error.message.includes('O plano Free inclui')) {
      return {
        error: `O plano Free inclui ${FREE_WORKSPACE_LIMIT} empresa. Faça upgrade para o Pro para gerenciar várias.`,
      }
    }
    return { error: 'Não foi possível concluir a configuração. Tente novamente.' }
  }

  const fechou = await gravarEstado(sessao, {
    status: 'completed',
    etapa: null,
    // O tour começa logo depois; deixá-lo em `not_started` é o que dispara a
    // primeira exibição no dashboard.
  })
  if ('error' in fechou) return fechou

  // De onde essa empresa veio, se veio de campanha rastreada. Update comum
  // (não a RPC), porque `utm_*` não está na lista de colunas protegidas por
  // `proteger_colunas_do_workspace` (0027) — só plan/id/created_by/created_at
  // são travadas contra edição direta. Engole erro de propósito: não é
  // motivo pra travar a criação da empresa por causa de metadado de marketing.
  if (workspaceId) {
    const atribuicao = await lerAtribuicaoUtm()
    if (atribuicao) {
      const { error: erroAtribuicao } = await sessao.supabase
        .from('workspaces')
        .update({
          utm_source: atribuicao.source ?? null,
          utm_medium: atribuicao.medium ?? null,
          utm_campaign: atribuicao.campaign ?? null,
        })
        .eq('id', workspaceId)

      if (erroAtribuicao) {
        console.error('Falha ao gravar atribuição de UTM', erroAtribuicao)
      } else {
        await limparIntencao(['utm'])
      }
    }
  }

  registrar('onboarding_company_completed', { workspaceId: workspaceId ?? undefined })
  registrar('onboarding_completed', {
    workspaceId: workspaceId ?? undefined,
    segmento,
    modeloVenda,
    tamanhoEquipe,
  })

  // A empresa pode ter acabado de nascer: toda tela do dashboard depende dela.
  revalidatePath('/', 'layout')

  // A empresa acabou de nascer; se a pessoa veio da landing querendo o Pro,
  // este é o momento de levá-la ao pagamento — sem isto ela cai no dashboard
  // em Free e tem que descobrir Configurações → Cobrança sozinha. A intenção
  // é consumida aqui: deixá-la no cookie faria toda criação de empresa
  // futura desviar para o checkout.
  const plano = await lerPlanoDesejado()
  if (plano === 'pro') {
    await limparIntencao(['plano'])
    return { success: true, workspaceId, destino: '/settings/billing?assinar=1' }
  }

  return { success: true, workspaceId, destino: '/dashboard' }
}

/**
 * "Pular por enquanto".
 *
 * Não bloqueia nada e não apaga progresso: quem respondeu duas etapas e pulou
 * mantém as respostas no `jsonb`. E `skipped` nunca volta a mostrar a tela de
 * boas-vindas — o pedido é explícito em não repetir isso a cada login.
 */
export async function pularOnboarding() {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const r = await gravarEstado(sessao, { status: 'skipped', etapa: null, tour_status: 'skipped' })
  if ('error' in r) return r

  registrar('onboarding_skipped')
  return { success: true }
}

export async function marcarTour(status: 'skipped' | 'completed') {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const r = await gravarEstado(sessao, { tour_status: status })
  if ('error' in r) return r

  registrar(status === 'skipped' ? 'tour_skipped' : 'tour_completed')
  return { success: true }
}

/** Preferência de exibição do checklist. O progresso em si é derivado. */
export async function ocultarChecklist(oculto: boolean) {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const r = await gravarEstado(sessao, { checklist_oculto: oculto })
  if ('error' in r) return r

  revalidatePath('/dashboard')
  return { success: true }
}

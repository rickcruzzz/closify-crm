'use server'

import { revalidatePath } from 'next/cache'

import { COOKIE_CONSENTIMENTO, podeRastrear } from '@/lib/analytics/consentimento'
import { cookies, headers } from 'next/headers'
import { z } from '@/lib/validations/zod'

import { createClient } from '@/lib/supabase/server'
import {
  lerAtribuicaoUtm,
  lerConvitePendente,
  lerPlanoDesejado,
  limparIntencao,
  type AtribuicaoUtm,
} from '@/lib/auth/intencao'
import { enviarConversaoDeRegistro } from '@/lib/analytics/meta-conversions'
import { appUrl } from '@/lib/app-url'
import { ipDaRequisicao } from '@/lib/request-ip'
import { registrar } from '@/lib/onboarding/eventos'
import {
  PASSOS_DO_GUIA,
  lerVisitadas,
  type ChaveDoPasso,
} from '@/lib/onboarding/guia'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { passoDoOnboardingSchema } from '@/lib/validations/onboarding'
import { FREE_WORKSPACE_LIMIT, MAX_WORKSPACE_LIMIT, PRO_WORKSPACE_LIMIT } from '@/lib/plans'
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
 * o navegador no meio, volta na etapa certa em vez de recomeçar, e o §15 do
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
  // desistir no meio, nada foi escrito na empresa, e uma empresa com nome
  // preenchido e mais nada seria pior do que empresa nenhuma.
  //
  // ## A leitura antes da escrita fecha um defeito de persistencia (17/09)
  //
  // Este `upsert` SUBSTITUIA `respostas` inteiro, e cada passo manda so o
  // proprio campo. Na pratica o `jsonb` guardava a ULTIMA resposta e nada
  // mais: responder o segmento apagava o nome da empresa gravado no passo
  // anterior.
  //
  // Nao aparecia em uso normal porque o assistente mantem tudo em memoria e so
  // le o banco ao RETOMAR — que e exatamente o caso que a 0030 existe para
  // atender, e o unico em que o defeito mordia. Quem fechasse o navegador no
  // passo 3 voltava com as duas primeiras respostas perdidas.
  //
  // E a mesma razao pela qual o guia interativo grava por leitura e mescla:
  // duas chaves no mesmo `jsonb` que se sobrescrevem sao uma bomba de tempo.
  const { data: anterior } = await sessao.supabase
    .from('onboarding_state')
    .select('respostas')
    .eq('user_id', sessao.userId)
    .maybeSingle()

  const { error: erroResposta } = await sessao.supabase.from('onboarding_state').upsert(
    {
      user_id: sessao.userId,
      status: 'in_progress',
      etapa,
      respostas: {
        ...((anterior?.respostas as Record<string, unknown> | null) ?? {}),
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
  tamanhoEquipe: z.enum(['so_eu', '2_5', '6_20', '21_mais', '21_100', '101_500', '500_mais']).optional(),
})

/**
 * A etapa de processamento: garante a empresa e fecha o onboarding.
 *
 * Trabalho real, sem espera artificial. Se a RPC responder em 300 ms, a tela
 * avança em 300 ms, o pedido é explícito quanto a isso, e barra de progresso
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
  // onboarding é um caminho novo até a mesma criação, sem repeti-la aqui, o
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
    // A 0078 acrescentou o teto do Pro. Sem esta segunda allowlist a mensagem
    // viraria "erro inesperado" — que é o que a pessoa NÃO pode ver depois de
    // ter pago.
    if (error.message.includes('O plano Pro inclui')) {
      return {
        error: `O plano Pro inclui ${PRO_WORKSPACE_LIMIT} empresas. Assine o Max para gerenciar até ${MAX_WORKSPACE_LIMIT}.`,
      }
    }
    // E a terceira, da 0094. Sem ela quem esta no Max e bateu em dez veria
    // "erro inesperado" — o pior texto possivel para quem paga R$ 250.
    if (error.message.includes('O plano Max inclui')) {
      return {
        error: `O plano Max inclui ${MAX_WORKSPACE_LIMIT} empresas. Fale com a gente para ter mais.`,
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
  // `proteger_colunas_do_workspace` (0027), só plan/id/created_by/created_at
  // são travadas contra edição direta. Engole erro de propósito: não é
  // motivo pra travar a criação da empresa por causa de metadado de marketing.
  let atribuicao: AtribuicaoUtm | null = null
  if (workspaceId) {
    atribuicao = await lerAtribuicaoUtm()
    if (atribuicao) {
      const { error: erroAtribuicao } = await sessao.supabase
        .from('workspaces')
        .update({
          utm_source: atribuicao.source ?? null,
          utm_medium: atribuicao.medium ?? null,
          utm_campaign: atribuicao.campaign ?? null,
          // Qual PECA trouxe, e nao so qual campanha. A campanha do Meta e um
          // teste de seis angulos apontando para o mesmo `/cadastro`, e sem
          // isto o teste nao conclui qual argumento vendeu. Ver 0069.
          utm_content: atribuicao.content ?? null,
          fbc: atribuicao.fbc ?? null,
          fbp: atribuicao.fbp ?? null,
          // O id de clique do Google, que e o unico dado aceito pela importacao
          // de conversao offline — a ponte entre "clicou no anuncio" e "pagou
          // R$ 49", que acontece dias depois no Asaas. Ver 0071.
          gclid: atribuicao.gclid ?? null,
          // Guardado aqui porque o `Purchase` nasce no webhook do Asaas, onde
          // não há cookie nem visitante. Sem isto, o evento que mais manda
          // dado pessoal seria o único fora da regra do banner. Ver 0065.
          consentimento_analitico: podeRastrear(
            (await cookies()).get(COOKIE_CONSENTIMENTO)?.value ?? null,
          ),
        })
        .eq('id', workspaceId)

      if (erroAtribuicao) {
        console.error('Falha ao gravar atribuição de UTM', erroAtribuicao)
      } else {
        await limparIntencao(['utm'])
      }
    }
  }

  // "CompleteRegistration" pro Meta, evento intermediário entre o clique no
  // anúncio e o eventual Purchase (que só existe se a pessoa virar Pro,
  // podendo levar dias por Pix/boleto). Dispara pra TODA conta, Free ou não
  //, o sinal que importa aqui é "chegou até nascer a empresa", não plano.
  // Engole erro de propósito, mesmo motivo do e-mail: telemetria não pode
  // travar a criação da conta.
  try {
    const {
      data: { user },
    } = await sessao.supabase.auth.getUser()
    if (user?.email) {
      // Cadastro acontece com a pessoa NO SITE, então o evento é de site e
      // não `system_generated`. Medido na API da Meta em 22/08: com o valor
      // antigo o canal web ficava sem nenhum dado de qualidade, e o evento
      // não era contado como conversão de site. IP e user agent vêm dos
      // headers desta própria requisição — é a pessoa real, não o servidor.
      const cabecalhos = await headers()
      await enviarConversaoDeRegistro({
        email: user.email,
        // ## Determinístico, como o `Lead` já era
        //
        // Era `crypto.randomUUID()`, o único evento de conversão do funil sem
        // id estável. Um reenvio — retentativa de rede, dois cliques, ou o
        // mesmo onboarding concluído de novo — virava dois
        // `CompleteRegistration` no dataset, inflando a contagem que o
        // algoritmo usa para aprender.
        //
        // `cadastro:${userId}` porque a chave natural é a PESSOA: um usuário
        // conclui o próprio onboarding uma vez, e a Meta deduplica sozinha
        // quando o id se repete. Mesma escolha do `lead:${userId}`, que foi
        // decidida com três casos de recadastro medidos contra produção.
        eventId: `cadastro:${user.id}`,
        fbc: atribuicao?.fbc,
        fbp: atribuicao?.fbp,
        telefone: user.phone || null,
        userId: user.id,
        actionSource: 'website',
        clientIp: await ipDaRequisicao(),
        clientUserAgent: cabecalhos.get('user-agent'),
        eventSourceUrl: `${appUrl()}/onboarding`,
      })
    }
  } catch (err) {
    console.error('Falha ao enviar CompleteRegistration pro Meta', err)
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
  // este é o momento de levá-la ao pagamento, sem isto ela cai no dashboard
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
 * boas-vindas, o pedido é explícito em não repetir isso a cada login.
 *
 * ## Por que exige empresa (24/08)
 *
 * Pular SEM empresa criada trancou 4 contas em produção, num loop infinito
 * entre `/dashboard` (que não achava empresa e mandava para `/onboarding`) e
 * `/onboarding` (que via `skipped` e mandava de volta). A pessoa via o
 * carregamento girar para sempre e nunca conseguia entrar — sem erro em lugar
 * nenhum, porque do ponto de vista do sistema estava tudo certo.
 *
 * A empresa só nasce no FIM do assistente. Antes disso não existe produto
 * para onde pular: "pular" ali significa pedir para ir a um lugar que não
 * existe.
 *
 * A tela também esconde o botão no primeiro passo, mas a regra precisa viver
 * aqui — Server Action é endpoint HTTP, e esconder botão não impede chamada.
 * Mesma doutrina de "regra que só vive na interface não é regra".
 */
export async function pularOnboarding() {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { count } = await sessao.supabase
    .from('workspace_members')
    .select('workspace_id', { count: 'exact', head: true })
    .eq('user_id', sessao.userId)

  if (!count) {
    return {
      error:
        'Informe o nome da sua empresa antes de continuar. É o único dado necessário para criar sua conta.',
    }
  }

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

/**
 * O progresso do guia interativo, lido do estado REAL.
 *
 * ## Por que isto e uma Server Action e nao uma prop do layout
 *
 * O guia e montado em `app/(dashboard)/layout.tsx`, que e o caminho quente de
 * TODA navegacao da area logada. Passar os sinais por prop faria as quatro
 * consultas daqui entrarem na renderizacao de cada tela, para todo mundo, para
 * sempre, e o layout ja carrega a licao: 196ms por consulta contra um banco em
 * Sao Paulo, vezes 8 a 10 por navegacao, esta registrado em
 * `docs/estado-atual.md` como o defeito que derrubou a performance em 12/08.
 *
 * Como Server Action, o custo e pago **so por quem esta com o guia aberto**, e
 * fora do caminho de render: a tela aparece primeiro, o guia chega depois.
 * Quem ja concluiu o onboarding, que e todo mundo a partir do segundo dia, nao
 * paga nada, porque o layout nem monta o componente.
 *
 * Devolve `null` quando nao ha sessao ou empresa, e o cliente esconde o guia.
 * Erro de leitura NAO inventa zero: zero contato significaria "faca o passo 1"
 * para quem ja fez, e o guia mandaria repetir o trabalho.
 */
export async function lerProgressoDoGuia(): Promise<{
  sinais: { leads: number; negocios: number; orcamentos: number }
  visitadas: ChaveDoPasso[]
  temMax: boolean
} | null> {
  const sessao = await abrirSessao()
  if ('error' in sessao) return null

  let workspaceId: string
  try {
    workspaceId = (await getCurrentUserAndWorkspace()).workspaceId
  } catch {
    return null
  }

  const contar = (tabela: 'leads' | 'deals') =>
    sessao.supabase
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

  const [leads, negocios, orcamentos, estado, max] = await Promise.all([
    contar('leads'),
    contar('deals'),
    // O sinal do passo 3 e a VALIDADE preenchida, nao o negocio existir. E a
    // mesma coluna que `lib/limits.ts` conta para o teto do Free, entao o guia
    // e o limite nao tem como discordar sobre o que e um orcamento.
    sessao.supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .not('orcamento_validade', 'is', null),
    sessao.supabase
      .from('onboarding_state')
      .select('respostas')
      .eq('user_id', sessao.userId)
      .maybeSingle(),
    situacaoDoMax(workspaceId),
  ])

  if (leads.error || negocios.error || orcamentos.error) {
    console.error('lerProgressoDoGuia falhou', leads.error ?? negocios.error ?? orcamentos.error)
    return null
  }

  return {
    sinais: {
      leads: leads.count ?? 0,
      negocios: negocios.count ?? 0,
      orcamentos: orcamentos.count ?? 0,
    },
    visitadas: lerVisitadas(estado.data?.respostas),
    temMax: max.maxVigente,
  }
}

/**
 * Marca que a pessoa conheceu uma tela do guia.
 *
 * ## Por que dentro de `respostas`, e nao numa coluna nova
 *
 * O `jsonb` da 0030 nasceu exatamente para isto, e o comentario da migration
 * diz por que: *"novas perguntas entram sem mexer na arquitetura, e coluna por
 * pergunta obrigaria uma migration a cada uma"*. Passo de guia e o mesmo caso.
 * O teto de 8 KB da 0030 continua valendo e cabe com folga: seis chaves curtas.
 *
 * ## A leitura antes da escrita nao e desperdicio
 *
 * O PostgREST nao sabe mesclar `jsonb` num `upsert` — `respostas` e substituido
 * inteiro. Sem ler antes, marcar a visita de Hoje apagaria o nome da empresa
 * que o assistente gravou, e a retomada do assistente passaria a comecar do
 * zero.
 */
export async function marcarVisitaDoGuia(chave: string) {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  // A chave vem do cliente, entao ela e conferida contra a lista real antes de
  // ir ao banco. Sem isto, um `POST` a mao encheria o `jsonb` ate o teto de
  // 8 KB da 0030 com strings inventadas.
  const visitada = PASSOS_DO_GUIA.find((p) => p.chave === chave)
  if (!visitada || visitada.conclusao.tipo !== 'visita') {
    return { error: 'Passo desconhecido.' }
  }

  const { data, error: erroLeitura } = await sessao.supabase
    .from('onboarding_state')
    .select('respostas')
    .eq('user_id', sessao.userId)
    .maybeSingle()

  if (erroLeitura) {
    console.error('marcarVisitaDoGuia nao conseguiu ler', erroLeitura)
    return { error: 'Não foi possível salvar seu progresso.' }
  }

  const anteriores = lerVisitadas(data?.respostas)
  if (anteriores.includes(visitada.chave)) return { success: true }

  const respostas = {
    ...((data?.respostas as Record<string, unknown> | null) ?? {}),
    guia: { visitadas: [...anteriores, visitada.chave] },
  }

  const { error } = await sessao.supabase
    .from('onboarding_state')
    .upsert({ user_id: sessao.userId, respostas }, { onConflict: 'user_id' })

  if (error) {
    console.error('marcarVisitaDoGuia falhou', error)
    return { error: 'Não foi possível salvar seu progresso.' }
  }

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

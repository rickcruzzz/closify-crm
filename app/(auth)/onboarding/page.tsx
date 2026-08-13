import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { lerEstadoDoOnboarding } from '@/lib/onboarding/estado'
import { lerPlanoDesejado } from '@/lib/auth/intencao'
import {
  AssistenteDeOnboarding,
  type RespostasSalvas,
} from '@/components/onboarding/assistente'
import type { ModeloVenda, OnboardingEtapa, TamanhoEquipe } from '@/types/supabase'

export const metadata: Metadata = {
  title: 'Configuração inicial',
  robots: { index: false, follow: false },
}

/**
 * O assistente de 4 perguntas.
 *
 * A tela antiga — só "nome da empresa" — virou o passo 1 daqui. As respostas
 * ficam no `jsonb` de `onboarding_state` até a etapa de processamento; a
 * empresa só é criada no fim, pela RPC idempotente. Quem desiste no meio não
 * deixa uma empresa com o nome preenchido e mais nada dentro.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const estado = await lerEstadoDoOnboarding()

  // Quem já concluiu ou pulou não volta para cá nem digitando a URL: sem isto,
  // terminar o assistente e apertar "voltar" no navegador ofereceria refazer a
  // configuração de uma empresa que já existe.
  if (estado.status === 'completed' || estado.status === 'skipped') {
    redirect('/dashboard')
  }

  const { data: linha } = await supabase
    .from('onboarding_state')
    .select('respostas')
    .eq('user_id', user.id)
    .maybeSingle()

  // O `jsonb` é escrito pela própria pessoa e pode conter qualquer coisa —
  // é uma tabela alcançável pelo PostgREST com a chave pública. Ler campo a
  // campo, conferindo o tipo, em vez de confiar no formato.
  const cru = (linha?.respostas ?? {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : undefined)

  const respostas: RespostasSalvas = {
    nomeEmpresa: texto(cru.nomeEmpresa),
    segmento: texto(cru.segmento),
    modeloVenda: texto(cru.modeloVenda) as ModeloVenda | undefined,
    tamanhoEquipe: texto(cru.tamanhoEquipe) as TamanhoEquipe | undefined,
  }

  // Retomar em `processando` recomeçaria a finalização sozinho, sem a pessoa
  // pedir. Volta para a última pergunta, que é onde ela pode conferir o que
  // respondeu antes de concluir.
  const etapaInicial: OnboardingEtapa =
    !estado.etapa || estado.etapa === 'processando' ? 'empresa' : estado.etapa

  // Quem já decidiu pagar não precisa das outras 3 perguntas antes de ver a
  // tela de cobrança — só o nome da empresa, o mínimo pra criar o workspace.
  // O resto do onboarding (segmento, modelo de venda, tamanho de equipe)
  // continua disponível depois, pelo checklist de ativação.
  const atalhoPro = (await lerPlanoDesejado()) === 'pro'

  return (
    <AssistenteDeOnboarding
      etapaInicial={etapaInicial}
      respostasIniciais={respostas}
      atalhoPro={atalhoPro}
    />
  )
}

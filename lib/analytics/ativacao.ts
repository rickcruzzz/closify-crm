import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { dadosDeCorrespondencia } from '@/lib/analytics/dados-de-correspondencia'
import { enviarConversaoDeAtivacao } from '@/lib/analytics/meta-conversions'

/**
 * O evento do PRIMEIRO contato criado numa empresa.
 *
 * ## Por que este evento existe, e por que ele é o mais importante do funil
 *
 * Auditoria de 31/08, medida no banco: das 5 empresas externas que se
 * cadastraram, **nenhuma criou um contato sequer**. E 43 de 49 concluem o
 * onboarding — ou seja, as pessoas terminam o assistente, caem num funil vazio
 * e param ali.
 *
 * Sem um evento nesse ponto, o melhor sinal que a Meta tem é
 * `CompleteRegistration`, que é o passo anterior e **já provou não bastar**:
 * otimizar por ele é pedir mais gente que se cadastra e não usa.
 *
 * `CustomizeProduct` é o evento padrão da Meta mais próximo de "a pessoa
 * começou a montar o dela". Usar um evento do catálogo, e não um customizado,
 * importa: eventos padrão entram nas otimizações e nos públicos semelhantes
 * sem configuração extra no gerenciador.
 *
 * ## Só o PRIMEIRO, e por quê
 *
 * Uma empresa que importa 300 contatos dispararia 300 eventos, e o algoritmo
 * concluiria que ela é 300 conversões. O `event_id` é `ativacao:<workspaceId>`
 * — determinístico e único por empresa —, então mesmo que o disparo aconteça
 * duas vezes a Meta deduplica.
 *
 * A checagem de "é o primeiro?" é uma contagem barata (`head: true`), e só
 * roda na criação de contato, que não é caminho quente.
 *
 * ## Nunca derruba a criação do contato
 *
 * Medição quebrada custa o DADO, nunca a ação do usuário. É a mesma regra do
 * `isolar-analytics.tsx`, escrita depois de o pixel derrubar o site inteiro em
 * 24/08.
 */
export async function registrarAtivacao(params: {
  workspaceId: string
  email: string
  userId: string
}) {
  try {
    const supabase = createAdminClient()

    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', params.workspaceId)

    // O contato recém-criado já está no banco quando isto roda, então o
    // primeiro é `count === 1`, não zero.
    if (count !== 1) return

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('fbc, fbp')
      .eq('id', params.workspaceId)
      .maybeSingle()

    const correspondencia = await dadosDeCorrespondencia(params.workspaceId)

    await enviarConversaoDeAtivacao({
      ...correspondencia,
      email: params.email,
      userId: params.userId,
      eventId: `ativacao:${params.workspaceId}`,
      fbc: workspace?.fbc ?? null,
      fbp: workspace?.fbp ?? null,
      actionSource: 'website',
    })
  } catch (erro) {
    console.error('registrarAtivacao falhou', erro)
  }
}

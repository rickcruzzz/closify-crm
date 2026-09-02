import { headers } from 'next/headers'
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

    // ## IP e user agent, e por que a falta deles era MEDIVEL
    //
    // Medido na API da Meta em 02/09, o Event Match Quality por evento:
    //
    //     InitiateCheckout       6.9   email ip user_agent external_id country fn
    //     CompleteRegistration   6.2   email ip user_agent external_id country
    //     AddPaymentInfo         6.2   email ip user_agent external_id country
    //     CustomizeProduct       5.4   email          external_id country fn
    //
    // Este evento era o de PIOR casamento do funil, e a causa aparece na
    // propria tabela: as duas chaves que faltam sao exatamente as duas que ele
    // nao mandava. `signUp` e `finalizarOnboarding` sempre passaram os
    // cabecalhos; este caminho nasceu sem, e ninguem notou porque nada falha.
    //
    // Importa mais do que parece: `CustomizeProduct` marca a ATIVACAO — a
    // pessoa criou o primeiro contato, ou seja, entendeu o produto. E o melhor
    // sinal de qualidade que este funil produz, e era o pior identificado.
    // Quanto menor o EMQ, menos a Meta consegue casar a conversao com quem viu
    // o anuncio, e menos ela aprende com quem de fato vale.
    //
    // `headers()` pode lancar fora de requisicao (o `catch` externo cobre),
    // entao a leitura e defensiva: sem cabecalho, envia como antes.
    let ip: string | null = null
    let agente: string | null = null
    let origem: string | null = null
    try {
      const cabecalhos = await headers()
      // `x-forwarded-for` pode vir com varios IPs; o primeiro e o do cliente.
      ip = cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      agente = cabecalhos.get('user-agent')
      const host = cabecalhos.get('host')
      origem = host ? `https://${host}/leads` : null
    } catch {
      // Chamado fora de uma requisicao. Segue sem as duas chaves, que e
      // exatamente o comportamento anterior.
    }

    await enviarConversaoDeAtivacao({
      ...correspondencia,
      email: params.email,
      userId: params.userId,
      eventId: `ativacao:${params.workspaceId}`,
      fbc: workspace?.fbc ?? null,
      fbp: workspace?.fbp ?? null,
      clientIp: ip,
      clientUserAgent: agente,
      actionSource: 'website',
      // `actionSource: 'website'` EXIGE a URL junto, pela documentacao
      // citada no proprio tipo. Ela ja era declarada aqui sem a URL, o
      // que e a combinacao que a Meta desconta.
      eventSourceUrl: origem ?? undefined,
    })
  } catch (erro) {
    console.error('registrarAtivacao falhou', erro)
  }
}

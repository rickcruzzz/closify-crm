import { createHash } from 'node:crypto'

const GRAPH_API_VERSION = 'v21.0'

type EventoDeAtribuicao = {
  email: string
  eventId: string
  /** `fb.1.<ms>.<fbclid>`, ver components/landing/utm-capture.tsx. */
  fbc?: string | null
  /** Cookie `_fbp` do próprio Pixel. */
  fbp?: string | null
  /**
   * Telefone em qualquer formato — a Meta normaliza por conta própria
   * (documentação oficial: aceita com/sem DDI, remove pontuação). Quando
   * `null`/ausente, o campo `ph` simplesmente não entra no payload.
   */
  telefone?: string | null
  /**
   * Nome de quem converteu, ou da empresa. Vira `fn` e `ln` hasheados.
   *
   * Sai de `workspaces.name`, que é o que a pessoa digitou no onboarding.
   * Para PME costuma ser o nome dela ou o da empresa, e os dois servem: a
   * Meta casa contra o perfil, que carrega ambos.
   */
  nome?: string | null
  /** Cidade da empresa, do onboarding. Vira `ct`. */
  cidade?: string | null
  /** Estado, sigla de dois caracteres. Vira `st`. */
  estado?: string | null
  /** CEP, com ou sem traço — só os dígitos são hasheados. Vira `zp`. */
  cep?: string | null
  /**
   * UUID do usuário no Supabase Auth. Vira `external_id` hasheado — um
   * terceiro identificador estável que não depende de cookie nem de o
   * e-mail bater exatamente, e é o que a documentação da Meta lista junto
   * de e-mail/telefone como os três que mais elevam o Event Match Quality
   * (a métrica que decide o quanto o algoritmo reconhece a conversão e
   * consegue otimizar a entrega em cima dela).
   */
  userId?: string | null
  /**
   * De onde a conversão veio, no vocabulário da Meta.
   *
   * Estava fixo em `system_generated` para os dois eventos, e isso custava
   * caro de um jeito invisível: medido em 22/08 na própria API da Meta, o
   * relatório de qualidade do canal web voltava VAZIO (`web: []`) e a
   * agregação por origem mostrava `SERVER` uma única vez em 7 dias, apesar de
   * 19 eventos terem sido enviados pela Conversions API na semana. Ou seja, os
   * eventos chegavam e não eram classificados como conversão de site.
   *
   * A documentação é explícita: evento de SITE enviado pela Conversions API
   * **exige** `action_source`, `client_user_agent` e `event_source_url`.
   * `system_generated` existe para conversão que nasce sem navegador nenhum —
   * é o caso do Purchase, que chega por webhook do Asaas horas depois do Pix,
   * e continua correto ali. Cadastro, não: acontece com a pessoa no site.
   */
  actionSource?: 'website' | 'system_generated'
  /** Só entra com `actionSource: 'website'`, e a Meta exige junto da URL. */
  clientUserAgent?: string | null
  clientIp?: string | null
  eventSourceUrl?: string | null
}

/**
 * Envia um evento pra Conversions API do Meta, direto do servidor, sem
 * cookie de terceiro, sem depender do navegador de quem converteu (o
 * pagamento acontece na página hospedada do Asaas, fora do site; o registro
 * de conta é Server Action, sem requisição de navegador própria nesse
 * instante).
 *
 * `action_source: 'system_generated'` é o valor certo aqui: não existe
 * sessão de navegador associada a ESTE request específico, mas `fbc`/`fbp`,
 * quando existem (capturados na landing e persistidos no workspace, ver
 * migration 0042), continuam sendo enviados: são âncoras de identidade que
 * não dependem do request atual ter vindo de um navegador.
 *
 * E-mail é o único identificador que sempre existe, hasheado em SHA-256
 * minúsculo, como a API exige. Telefone e `external_id` entram do mesmo
 * jeito quando disponíveis — mais identificadores por evento é o que a
 * documentação da Meta aponta como o principal alavancador do Event Match
 * Quality, e Match Quality mais alto é o que faz o algoritmo aprender mais
 * rápido quem de fato converte. `fbc`/`fbp` nunca são hasheados (a API
 * espera o valor cru nesses dois campos).
 */
export function normalizarTelefone(valor: string): string {
  // A Meta documenta que aceita variação de formatação, mas recomenda
  // remover tudo que não é dígito antes de hashear — reduz a chance de duas
  // grafias do mesmo número ("(11) 99999-9999" vs "11999999999") virarem
  // hashes diferentes e nunca casarem.
  return valor.replace(/\D/g, '')
}

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

/**
 * Os eventos que este projeto manda, na ordem do funil.
 *
 * `Lead` e `ViewContent` são de topo e existem por uma razão de mídia, não de
 * completude: a Meta precisa de ~50 conversões por semana do evento otimizado
 * para sair da fase de aprendizado, e este produto fez **7 Purchase em 17
 * dias** (medido na API em 30/08). Otimizar campanha por Purchase com esse
 * volume é pagar o algoritmo para chutar. O evento de topo é por onde a
 * campanha começa; os de baixo entram quando houver volume.
 *
 * `ViewContent` não aparece aqui porque é o único disparado pelo navegador —
 * ver `lib/analytics/pixel-evento.ts`.
 */
type EventoDaMeta =
  | 'Lead'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'CustomizeProduct'

/**
 * Monta o corpo que vai para a Graph API.
 *
 * Separada do envio porque é a parte que dá para testar sem rede: o que
 * hasheia, o que entra só quando existe, e o `test_event_code`. Testar isso
 * mockando `fetch` provaria que o mock foi chamado, não que o payload está
 * certo — e é o payload que a Meta lê.
 */
export function montarCorpoDoEvento(
  eventName: EventoDaMeta,
  params: EventoDeAtribuicao & { customData?: Record<string, unknown> },
  testEventCode?: string,
) {
  const emailHash = sha256(params.email.trim().toLowerCase())
  const telefoneHash = params.telefone ? sha256(normalizarTelefone(params.telefone)) : null
  const externalIdHash = params.userId ? sha256(params.userId) : null

  // ## Os parâmetros que faltavam, e por que eles importam
  //
  // O Event Match Quality medido em 30/08 foi 6,2 de 10, com e-mail, IP, user
  // agent e `external_id` em 100% de cobertura. O que faltava para subir não
  // era instrumentação nova: **o produto já guardava nome, cidade, estado e
  // CEP da empresa**, coletados no onboarding, e nenhum era enviado.
  //
  // Cada parâmetro amplia a janela de correspondência da Meta. Com EMQ mais
  // alto, a mesma verba alcança mais gente certa — é o multiplicador mais
  // barato que existe aqui, porque o dado já foi coletado e está no banco.
  //
  // ## Todos hasheados, e normalizados como a API exige
  //
  // A Meta especifica a normalização de cada campo, e errar nela é pior que
  // não mandar: hash de string não normalizada nunca casa com nada, e o
  // parâmetro conta como cobertura sem produzir correspondência. Minúsculas,
  // sem acento e sem pontuação para nome e cidade; sigla de dois caracteres
  // para estado; só dígitos para CEP.
  //
  // `country` é constante: este produto vende no Brasil, e a landing está em
  // português com preço em real. Mandá-lo eleva a correspondência sem custo.
  const normalizar = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const hashSeExistir = (v: string | null | undefined) => {
    if (!v) return null
    const limpo = normalizar(v)
    return limpo ? sha256(limpo) : null
  }

  // O nome vem da empresa: `workspaces.name` é o que a pessoa digitou no
  // onboarding, e para PME costuma ser o nome dela ou o da empresa. Os dois
  // servem — a Meta casa contra o perfil, que tem os dois.
  const partes = (params.nome ?? '').trim().split(/\s+/).filter(Boolean)
  const primeiroNomeHash = hashSeExistir(partes[0])
  const sobrenomeHash = partes.length > 1 ? hashSeExistir(partes[partes.length - 1]) : null
  const cidadeHash = hashSeExistir(params.cidade)
  const estadoHash = hashSeExistir(params.estado)
  const cepHash = params.cep ? hashSeExistir(params.cep.replace(/\D/g, '')) : null

  return {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: params.actionSource ?? 'system_generated',
        // A Meta trata como obrigatório para evento de site, e é o par que
        // mais eleva o Event Match Quality depois de e-mail e telefone.
        ...(params.eventSourceUrl ? { event_source_url: params.eventSourceUrl } : {}),
        user_data: {
          em: [emailHash],
          ...(telefoneHash ? { ph: [telefoneHash] } : {}),
          ...(externalIdHash ? { external_id: [externalIdHash] } : {}),
          ...(params.fbc ? { fbc: params.fbc } : {}),
          ...(params.fbp ? { fbp: params.fbp } : {}),
          ...(params.clientIp ? { client_ip_address: params.clientIp } : {}),
          ...(params.clientUserAgent ? { client_user_agent: params.clientUserAgent } : {}),
          ...(primeiroNomeHash ? { fn: [primeiroNomeHash] } : {}),
          ...(sobrenomeHash ? { ln: [sobrenomeHash] } : {}),
          ...(cidadeHash ? { ct: [cidadeHash] } : {}),
          ...(estadoHash ? { st: [estadoHash] } : {}),
          ...(cepHash ? { zp: [cepHash] } : {}),
          // Constante, e hasheada como os demais: a API recusa `country` em
          // texto puro no mesmo objeto em que os outros vão hasheados.
          country: [sha256('br')],
        },
        ...(params.customData ? { custom_data: params.customData } : {}),
      },
    ],
    // Manda o evento para o painel "Testar eventos" da Meta. **Existe só para
    // a prova, e nunca é definida em produção.**
    //
    // Exercitar o funil para conferir que um evento dispara escreve no MESMO
    // conjunto com que o algoritmo aprende quem perseguir — o defeito que
    // custou caro em 20/08, com 18.192 PageViews de `localhost` ensinando a
    // Meta a procurar gente que não existe.
    //
    // **O código precisa ser o REAL, copiado de Gerenciador de Eventos →
    // Testar eventos.** Medido em 30/08, e ao contrário do que este comentário
    // afirmava antes: com um código inventado (`TEST00000`) a Meta responde
    // `events_received: 1` e **grava no dataset de produção assim mesmo**.
    // Não há erro, não há aviso — o payload parece certo e o evento entra.
    //
    // Por isso a forma segura de provar um evento novo não é esta variável, e
    // sim rodar o servidor com `META_CONVERSIONS_API_TOKEN` inválido: a Meta
    // recusa, o `console.error` abaixo prova que a linha foi alcançada, e nada
    // é gravado. Esta variável só ajuda quem tiver o código real em mãos.
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }
}

async function enviarEventoParaMeta(
  eventName: EventoDaMeta,
  params: EventoDeAtribuicao & { customData?: Record<string, unknown> },
): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CONVERSIONS_API_TOKEN

  // Sem as duas credenciais, não tem o que mandar, mesmo padrão do resto
  // do projeto: falta de env var não quebra nada, só não faz o efeito.
  if (!pixelId || !token) return

  const corpo = montarCorpoDoEvento(eventName, params, process.env.META_TEST_EVENT_CODE)

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      },
    )

    if (!res.ok) {
      const texto = await res.text()
      console.error(`Meta Conversions API: falha ao enviar ${eventName}`, res.status, texto)
    }
  } catch (err) {
    console.error(`Meta Conversions API: erro ao enviar ${eventName}`, err)
  }
}

/**
 * "Purchase", disparado quando o webhook do Asaas confirma pagamento de
 * verdade (app/api/webhooks/asaas/route.ts). `event_id` vem do id de evento
 * do próprio webhook, que já é único por natureza do dedupe existente.
 */
export async function enviarConversaoDeCompra(
  params: EventoDeAtribuicao & { valor: number },
): Promise<void> {
  await enviarEventoParaMeta('Purchase', {
    ...params,
    customData: { currency: 'BRL', value: params.valor },
  })
}

/**
 * "CompleteRegistration", disparado quando a empresa nasce de verdade
 * (lib/onboarding/actions.ts, finalizarOnboarding), pra toda conta, Pro ou
 * Free. Existe porque mandar só o Purchase falha em ciclo de venda que não
 * é instantâneo (Pix/boleto levam horas, e o produto é Free-primeiro): sem
 * um evento intermediário, o clique original pode já ter saído da janela
 * de atribuição quando o pagamento finalmente confirma.
 */
export async function enviarConversaoDeRegistro(params: EventoDeAtribuicao): Promise<void> {
  await enviarEventoParaMeta('CompleteRegistration', params)
}

/**
 * "Lead", disparado quando o cadastro cria a conta de verdade
 * (`lib/supabase/actions.ts`, `signUp`).
 *
 * ## Por que ele é o evento mais importante desta lista
 *
 * É o de MAIOR volume real do funil, e volume é o que falta. A Meta precisa de
 * ~50 conversões por semana do evento otimizado para sair da fase de
 * aprendizado; este produto fez 7 Purchase em 17 dias. A campanha começa
 * otimizando por aqui e sobe para `CompleteRegistration` e `Purchase` quando
 * cada um tiver volume próprio.
 *
 * ## A guarda que o chamador PRECISA aplicar
 *
 * Com "Confirm email" ativo, e-mail já cadastrado **não volta como erro**: o
 * Supabase devolve sucesso com `identities: []`, de propósito, para não
 * permitir enumerar quem tem conta. Disparar sem checar isso faria toda
 * tentativa de recadastro virar um Lead — e o número que a Meta usa para
 * aprender ficaria inflado justamente por quem JÁ é cliente, que é o oposto
 * do público a perseguir.
 */
export async function enviarConversaoDeLead(params: EventoDeAtribuicao): Promise<void> {
  await enviarEventoParaMeta('Lead', params)
}

/**
 * "CustomizeProduct", disparado quando a empresa cria o PRIMEIRO contato.
 *
 * ## É o evento que faltava, e o mais importante do funil
 *
 * Auditoria de 31/08, medida no banco: das 5 empresas externas cadastradas,
 * **nenhuma criou um contato**. E 43 de 49 concluem o onboarding — as pessoas
 * terminam o assistente, caem num funil vazio e param ali.
 *
 * Sem evento nesse ponto, o melhor sinal disponível para a Meta é
 * `CompleteRegistration`, que é o passo ANTERIOR e já provou não bastar:
 * otimizar por ele é pedir mais gente que se cadastra e não usa.
 *
 * ## Por que um evento do catálogo, e não um customizado
 *
 * `CustomizeProduct` é o padrão mais próximo de "a pessoa começou a montar o
 * dela". Evento padrão entra em otimização e em público semelhante sem
 * configuração extra no gerenciador; evento customizado exige criar uma
 * conversão personalizada antes de servir para alguma coisa.
 *
 * Quem dispara é `registrarAtivacao` (`lib/analytics/ativacao.ts`), que
 * garante o "primeiro" e usa `event_id` determinístico por empresa.
 */
export async function enviarConversaoDeAtivacao(
  params: EventoDeAtribuicao,
): Promise<void> {
  await enviarEventoParaMeta('CustomizeProduct', params)
}

/**
 * "InitiateCheckout", disparado quando a assinatura nasce no Asaas com
 * cobrança gerada (`lib/asaas/actions.ts`, `createCheckout`).
 *
 * É o sinal mais próximo da compra que existe sem ter havido pagamento, e
 * preenchia um vão de dias: entre o registro e o Purchase há Pix e boleto, que
 * levam horas ou não acontecem nunca.
 *
 * `event_id` determinístico (`checkout:<subscriptionId>`) e não um UUID novo:
 * o diálogo de pagamento pode ser fechado e reaberto, e cada reabertura
 * contaria como uma intenção de compra a mais. Com id estável a Meta
 * deduplica sozinha.
 */
export async function enviarConversaoDeInicioDeCheckout(
  params: EventoDeAtribuicao & { valor: number },
): Promise<void> {
  await enviarEventoParaMeta('InitiateCheckout', {
    ...params,
    customData: { currency: 'BRL', value: params.valor },
  })
}

/**
 * "AddPaymentInfo", disparado quando o Pix e o boleto daquela cobrança
 * carregam na tela (`lib/asaas/actions.ts`, `obterFormasDePagamento`).
 *
 * É o último passo antes do pagamento: a pessoa está com o QR Code na frente.
 * Quem chega aqui e não paga é o público de remarketing mais valioso que este
 * funil produz.
 *
 * Mesmo cuidado de `event_id` do irmão acima, por `pagamento:<cobrancaId>`.
 */
export async function enviarConversaoDeFormaDePagamento(
  params: EventoDeAtribuicao & { valor: number },
): Promise<void> {
  await enviarEventoParaMeta('AddPaymentInfo', {
    ...params,
    customData: { currency: 'BRL', value: params.valor },
  })
}

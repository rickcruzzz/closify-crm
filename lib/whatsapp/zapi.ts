import 'server-only'

/**
 * O único lugar do projeto que fala HTTP com a Z-API.
 *
 * ## Por que existe uma camada aqui, e não `fetch` espalhado
 *
 * `lib/conversas/remetente.ts` já registra a fronteira desde 28/08: regra de
 * produto de um lado, transporte do outro. Este arquivo é o transporte, e ele
 * é o ÚNICO que conhece a forma da URL, o cabeçalho de autenticação e o
 * vocabulário do provedor.
 *
 * Quem chama daqui para cima nunca vê `zaapId`, `Client-Token` nem
 * `instances/{id}/token/{token}`. Isso é o que faz a Cloud API da Meta, quando
 * chegar, custar um arquivo novo em vez de uma varredura.
 *
 * ## O contrato, lido na documentação oficial em 16/09
 *
 *     base       https://api.z-api.io/instances/{id}/token/{token}/{endpoint}
 *     cabecalho  Client-Token: <token de seguranca da CONTA>
 *     partner    Authorization: Bearer <Partner-Token>
 *
 * Nada aqui é suposição sobre a documentação. O defeito de 25/08 nasceu
 * exatamente disso: a rota do Evolution foi escrita a partir do Swagger, que
 * descreve outra forma, e ela respondia `200` sem gravar nada.
 *
 * ## As credenciais, e o que é de cada nível
 *
 *     ZAPI_CLIENT_TOKEN   por CONTA. Vale para TODAS as instancias, e por isso
 *                         mora no ambiente e nunca no banco
 *     ZAPI_PARTNER_TOKEN  por CONTA. Cria e apaga instancia, ou seja gasta
 *                         dinheiro. So o caminho de conexao o usa
 *     token da instancia  por EMPRESA. Cifrado em `whatsapp_instances`, com a
 *                         mesma chave que guarda o token do Google desde 12/08
 *
 * Nenhum dos três pode chegar ao navegador. `server-only` faz o build falhar se
 * um client component importar este módulo, direta ou indiretamente — mesma
 * defesa de `lib/supabase/admin.ts`.
 */

const BASE = 'https://api.z-api.io'

/**
 * Teto de espera por chamada.
 *
 * Oito segundos, contra o `maxDuration` de 15 das rotas de webhook. A folga é
 * deliberada: uma chamada que estoura precisa devolver erro NOSSO, com mensagem,
 * em vez de a função inteira ser morta pela plataforma — quando isso acontece a
 * resposta é um 504 genérico, o provedor reentrega, e o laço recomeça.
 */
const TIMEOUT_MS = 8_000

export class ZapiError extends Error {
  constructor(
    readonly status: number,
    readonly caminho: string,
    readonly corpo: string,
  ) {
    super(`Z-API respondeu ${status} em ${caminho}`)
    this.name = 'ZapiError'
  }
}

/** As credenciais de UMA instância, já decifradas. Nunca saem daqui para cima. */
export type Instancia = {
  instanceId: string
  token: string
}

function clientToken(): string {
  const token = process.env.ZAPI_CLIENT_TOKEN
  // Falha FECHADA, e com a causa nomeada. Sem isto a chamada sairia sem o
  // cabeçalho e a Z-API responderia 403 — erro de configuração com cara de
  // credencial revogada, que manda depurar no lugar errado.
  if (!token) throw new Error('ZAPI_CLIENT_TOKEN não configurado.')
  return token
}

async function chamar<T>(
  caminho: string,
  opcoes: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const controlador = new AbortController()
  const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(`${BASE}${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...opcoes.headers,
      },
      body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
      signal: controlador.signal,
      // Toda leitura aqui é de estado que muda por minuto (conectado, QR). O
      // cache do Next guardaria um QR expirado e a pessoa leria um código morto.
      cache: 'no-store',
    })

    const texto = await resposta.text()
    if (!resposta.ok) {
      // O corpo entra no erro porque a Z-API explica a recusa nele, e o status
      // sozinho não distingue "número inválido" de "instância desconectada".
      throw new ZapiError(resposta.status, caminho, texto.slice(0, 500))
    }

    // Resposta vazia é sucesso em alguns endpoints (desconectar). `{}` evita
    // que `JSON.parse('')` lance e vire "falhou" o que deu certo.
    return (texto ? JSON.parse(texto) : {}) as T
  } finally {
    clearTimeout(relogio)
  }
}

function comInstancia(instancia: Instancia, endpoint: string): string {
  return `/instances/${instancia.instanceId}/token/${instancia.token}/${endpoint}`
}

// ---------------------------------------------------------------------------
// Partner: criar e apagar instância
// ---------------------------------------------------------------------------

export type InstanciaCriada = {
  id: string
  token: string
  /** Quando o trial de 2 dias expira, em milissegundos. */
  due?: number
}

/**
 * Cria uma instância e já deixa os webhooks apontados.
 *
 * ## Os webhooks entram na MESMA chamada, e isso é decisão
 *
 * Configurá-los depois criaria uma janela em que a instância existe e não
 * avisa nada: se a segunda chamada falhar, fica uma instância faturando que
 * nunca entrega mensagem, e o sintoma é silêncio. Silêncio é o mais caro de
 * perceber, e é a lição que este projeto já pagou três vezes.
 *
 * ## O trial de 2 dias
 *
 * A Z-API documenta que a instância criada assim funciona por dois dias e é
 * **apagada automaticamente** sem assinatura. Isso é do provedor, não nosso: a
 * assinatura da instância é feita no painel do Partner.
 *
 * Fica escrito porque a leitura errada é fácil: uma instância que some sozinha
 * depois de 48h parece defeito de código.
 */
export async function criarInstancia(params: {
  nome: string
  webhookRecebida: string
  webhookStatus: string
  webhookDesconexao: string
}): Promise<InstanciaCriada> {
  const partner = process.env.ZAPI_PARTNER_TOKEN
  if (!partner) throw new Error('ZAPI_PARTNER_TOKEN não configurado.')

  return chamar<InstanciaCriada>('/partner/instances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${partner}` },
    body: {
      name: params.nome,
      deliveryCallbackUrl: params.webhookStatus,
      receivedCallbackUrl: params.webhookRecebida,
      messageStatusCallbackUrl: params.webhookStatus,
      disconnectedCallbackUrl: params.webhookDesconexao,
      // ## "Notify sent by me", e é o que faz a caixa de entrada ser honesta
      //
      // Sem isto, a mensagem que o dono manda PELO CELULAR não chega ao CRM, e
      // a tela mostra metade da conversa: as perguntas do cliente sem nenhuma
      // resposta ao lado. A pessoa conclui que o produto perdeu o que ela
      // escreveu, e volta para o celular — que é o hábito que este recurso
      // existe para desfazer.
      notifySentByMe: true,
    },
  })
}

/**
 * Apaga a instância no provedor.
 *
 * É o que PARA a cobrança. Desconectar sozinho tira o número do WhatsApp e
 * deixa a instância faturando, e a diferença entre as duas coisas é a fatura
 * do mês seguinte.
 */
export async function apagarInstancia(instanceId: string): Promise<void> {
  const partner = process.env.ZAPI_PARTNER_TOKEN
  if (!partner) throw new Error('ZAPI_PARTNER_TOKEN não configurado.')

  await chamar(`/partner/instances/${instanceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${partner}` },
  })
}

// ---------------------------------------------------------------------------
// Instância: QR, status, envio, desconexão
// ---------------------------------------------------------------------------

/**
 * O QR Code em base64, ou `null` quando já está conectado.
 *
 * A Z-API pode devolver, no lugar da imagem, um objeto `challenge` — é o fluxo
 * de Passkey, que aparelho novo exige. Ele NÃO é tratado aqui: o caminho de
 * Passkey pede interação que este produto não tem, e devolver `null` faz a tela
 * dizer "não foi possível gerar o QR" em vez de desenhar um dado que o
 * navegador não sabe renderizar.
 *
 * Fica escrito porque a alternativa silenciosa seria pior: um `<img>` com um
 * objeto JSON dentro não mostra erro nenhum, só um quadrado quebrado.
 */
export async function qrCode(instancia: Instancia): Promise<string | null> {
  const r = await chamar<{ value?: string; connected?: boolean; challenge?: unknown }>(
    comInstancia(instancia, 'qr-code/image'),
    { headers: { 'Client-Token': clientToken() } },
  )

  if (r.connected) return null
  if (r.challenge) return null
  return typeof r.value === 'string' && r.value.length > 0 ? r.value : null
}

export type StatusDaInstancia = {
  connected: boolean
  smartphoneConnected: boolean
  error: string | null
}

export async function statusDaInstancia(instancia: Instancia): Promise<StatusDaInstancia> {
  const r = await chamar<{
    connected?: boolean
    smartphoneConnected?: boolean
    error?: string
  }>(comInstancia(instancia, 'status'), { headers: { 'Client-Token': clientToken() } })

  return {
    connected: r.connected === true,
    smartphoneConnected: r.smartphoneConnected === true,
    error: typeof r.error === 'string' && r.error.length > 0 ? r.error : null,
  }
}

/** O número conectado, quando existe. Vem de `device`, não de `status`. */
export async function telefoneConectado(instancia: Instancia): Promise<string | null> {
  const r = await chamar<{ phone?: string }>(comInstancia(instancia, 'device'), {
    headers: { 'Client-Token': clientToken() },
  })
  return typeof r.phone === 'string' && r.phone.length > 0 ? r.phone.replace(/\D/g, '') : null
}

export type TextoEnviado = {
  /** O id da mensagem no WhatsApp. É o que casa com `mensagens.external_id`. */
  messageId: string | null
}

/**
 * Manda um texto.
 *
 * `delayTyping` de dois segundos: a Z-API mostra "digitando..." antes de
 * entregar. Não é enfeite — a mensagem que aparece instantaneamente depois de
 * uma pergunta longa denuncia robô, e o número em risco é o do cliente.
 *
 * Devolve `messageId` e não `zaapId`: o primeiro é o id do WhatsApp, que é o
 * que volta no `MessageStatusCallback`. O `zaapId` é interno da Z-API e não
 * casa com nada do nosso lado.
 */
export async function enviarTexto(
  instancia: Instancia,
  telefone: string,
  mensagem: string,
): Promise<TextoEnviado> {
  const r = await chamar<{ messageId?: string; zaapId?: string; id?: string }>(
    comInstancia(instancia, 'send-text'),
    {
      method: 'POST',
      headers: { 'Client-Token': clientToken() },
      body: {
        // Só dígitos, DDI+DDD+número. A Z-API recusa qualquer máscara.
        phone: telefone.replace(/\D/g, ''),
        message: mensagem,
        delayTyping: 2,
      },
    },
  )

  return { messageId: r.messageId ?? r.id ?? null }
}

/**
 * Aponta os webhooks de uma instância que JÁ existe, sem a Partner API.
 *
 * ## Por que isto existe ao lado de `criarInstancia`
 *
 * `criarInstancia` já configura os quatro webhooks na mesma chamada, e é o
 * caminho que o cliente percorre. Esta função serve o outro caso: uma instância
 * criada **à mão no painel**, que é o único jeito de exercitar o produto inteiro
 * sem o Partner token — e o Partner tem condição comercial a partir de dez
 * instâncias.
 *
 * ## O caminho NÃO está confirmado na documentação, e isso fica escrito
 *
 * Lida em 16/09, a documentação da Z-API descreve o corpo
 * (`{ value, notifySentByMe }`) e o método (POST ou PUT), e **não publica o
 * segmento de caminho** depois de `token/{token}/`. `update-every-webhooks` é o
 * nome da página, não um contrato lido.
 *
 * Por isso esta função **devolve se deu certo em vez de afirmar que deu**. O
 * chamador mostra as três URLs de qualquer jeito, e a pessoa confere no painel.
 *
 * É a lição de 12/09 aplicada antes do prejuízo: `sendButtons` respondeu 201
 * quatro vezes e nenhuma mensagem renderizou. **Aceitar não é entregar**, e um
 * webhook que não foi configurado de verdade produz o pior sintoma que existe
 * aqui: silêncio, com a tela dizendo conectado.
 */
export async function tentarConfigurarWebhooks(
  instancia: Instancia,
  urlBase: string,
): Promise<{ confirmado: boolean; motivo?: string }> {
  try {
    await chamar(comInstancia(instancia, 'update-every-webhooks'), {
      method: 'PUT',
      headers: { 'Client-Token': clientToken() },
      body: {
        value: urlBase,
        // O que faz a mensagem enviada pelo CELULAR do dono aparecer no CRM.
        // Sem isto a caixa mostra as perguntas do cliente sem nenhuma resposta
        // ao lado, e a pessoa conclui que o produto perdeu o que ela escreveu.
        notifySentByMe: true,
      },
    })
    return { confirmado: true }
  } catch (erro) {
    const motivo = erro instanceof ZapiError ? `${erro.status} em ${erro.caminho}` : String(erro)
    console.error('tentarConfigurarWebhooks: nao confirmado', motivo)
    return { confirmado: false, motivo }
  }
}

/**
 * Tira o número do WhatsApp, e **mantém a instância**.
 *
 * É o que a pessoa quer quando clica em "Desconectar": trocar de aparelho,
 * parear de novo. Apagar a instância aqui obrigaria a criar outra na
 * reconexão, o que gasta dinheiro e muda o `instanceId` que os webhooks já
 * conhecem.
 *
 * Quem para a cobrança é `apagarInstancia`, e ela é outro botão.
 */
export async function desconectar(instancia: Instancia): Promise<void> {
  await chamar(comInstancia(instancia, 'disconnect'), {
    headers: { 'Client-Token': clientToken() },
  })
}

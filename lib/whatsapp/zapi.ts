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
 * ## MEDIDO contra a conta real em 17/09, e não lido
 *
 *     GET  /status                  200  {connected, error, smartphoneConnected}
 *     GET  /qr-code/image           200  {"value":"data:image/png;base64,..."}
 *     GET  /device                  400  "You need to be connected" (existe)
 *     GET  /disconnect              200  {"value":true}
 *     POST /send-text               200  {zaapId, messageId, id}
 *     PUT  /update-every-webhooks   200  {"value":true}
 *
 * E o Client-Token esta ATIVO nesta conta, provado nos tres sentidos:
 *
 *     com o token     200
 *     SEM o token     400  "your client-token is not configured"
 *     token errado    403  "Client-Token not allowed"
 *
 * ## A documentacao foi fonte ERRADA cinco vezes hoje
 *
 * Ela descreve o CORPO e o EFEITO, e frequentemente nao publica o caminho nem o
 * metodo. A frase "verifique se voce enviou POST ou GET" aparece na secao de
 * erro de TODA pagina, e nao e especificacao de nada.
 *
 * Duas vezes eu "consertei" o que ja estava certo lendo o documento, e a API
 * real desfez as duas. **A API e a unica autoridade**, e o defeito de 25/08
 * nasceu exatamente do contrario: a rota do Evolution foi escrita a partir do
 * Swagger, que descreve outra forma, e ela respondia `200` sem gravar nada.
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
 * O produto consegue criar instância sozinho?
 *
 * ## Por que isto é uma pergunta, e não um pressuposto
 *
 * Criar e cancelar instância exige o **Partner token**, e o programa Partner da
 * Z-API pede **10 instâncias contratadas**: R$ 899,90 por mês, fixos. A conta
 * que decide está medida, e ela inverte com o número de clientes:
 *
 *     ate 9 clientes Max    pagar por instancia sai mais barato
 *     a partir de 10        o Partner vira o barato
 *
 * Abaixo de nove, contratar seria pagar por vaga vazia. Então o produto precisa
 * funcionar nos DOIS modos, e a diferença entre eles é uma variável de ambiente.
 *
 * ## O que muda quando isto é `false`
 *
 * O cliente não cria a instância no clique. Ele pede, o dono é avisado por
 * e-mail, cria no painel e cola as credenciais. Tudo o mais é idêntico: receber,
 * responder, QR, status, caixa de entrada e o gate do plano não tocam no
 * Partner.
 *
 * A tela pergunta isto **no servidor** e escolhe o que mostrar. Sem a pergunta,
 * o botão chamaria a API, tomaria erro e diria "tente de novo em alguns
 * minutos" — mentira, para quem acabou de pagar R$ 250.
 */
export function provisionamentoAutomatico(): boolean {
  return Boolean(process.env.ZAPI_PARTNER_TOKEN)
}

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

  // ## `/instances`, e nao `/partner/instances`
  //
  // O que distingue a chamada de Partner da de instancia NAO e o caminho: e o
  // cabecalho. `Authorization: Bearer <Partner-Token>` no lugar do
  // `Client-Token`, e a documentacao diz em texto que o Client-Token nao vai
  // nestas requisicoes.
  //
  // A prova esta no endpoint de LISTAR, que a documentacao publica: `GET
  // /instances`. Mesmo recurso, verbo diferente. Eu tinha escrito
  // `/partner/instances` por analogia com o nome da secao do documento.
  //
  // **Continua sendo o unico caminho deste arquivo sem confirmacao direta**, e
  // uma chamada real com o Partner token fecha a duvida. Ele falha ALTO: sem
  // instancia criada, `conectarWhatsapp` devolve erro com mensagem e nao grava
  // nada. Nao ha risco de sucesso silencioso.
  return chamar<InstanciaCriada>('/instances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${partner}` },
    body: {
      name: params.nome,
      // ## `receivedAndDelivery` e NÃO `received`, e a diferença é a metade
      // que faltava da conversa
      //
      // O primeiro corte deste arquivo mandava `receivedCallbackUrl` mais
      // `notifySentByMe: true`. **`notifySentByMe` não existe neste endpoint** —
      // conferido campo a campo na documentação em 17/09, e a lista de
      // opcionais não o tem. Ele seria ignorado em silêncio, e o sintoma seria
      // a caixa mostrando as perguntas do cliente sem nenhuma resposta ao lado.
      //
      // Quem entrega as duas direções é `receivedAndDeliveryCallbackUrl`,
      // descrito como *"Webhook URL for received and sent messages"*. A rota de
      // recebimento já sabe tratar `fromMe`: ela grava a nossa como `enviada` e
      // FECHA a espera da conversa.
      //
      // Sem isso a pessoa conclui que o produto perdeu o que ela escreveu, e
      // volta para o celular — que é o hábito que este recurso existe para
      // desfazer.
      receivedAndDeliveryCallbackUrl: params.webhookRecebida,
      // O MESMO destino tambem em `receivedCallbackUrl`, e e o que a adocao
      // faz desde 18/09. Medido em `GET /me`: os dois campos existem lado a
      // lado, e nada na documentacao diz que o combinado sozinho encaminha o
      // que CHEGA. Apontar os dois para a mesma rota custa nada, e a rota ja
      // deduplica por `external_id`.
      receivedCallbackUrl: params.webhookRecebida,
      messageStatusCallbackUrl: params.webhookStatus,
      disconnectedCallbackUrl: params.webhookDesconexao,
    },
  })
}

/**
 * ASSINA a instância, e sem isto ela morre em 48 horas.
 *
 * ## O que acontece sem esta chamada
 *
 * `criarInstancia` devolve uma instância em **trial de dois dias**. A Z-API a
 * apaga sozinha se ninguém assinar: *"após 2 dias sem assinatura, a instância é
 * automaticamente deletada"*.
 *
 * Na prática, um cliente que pagasse o Max numa sexta e lesse o QR no mesmo dia
 * teria o WhatsApp da empresa dele desligado no domingo, **sem nada falhar do
 * nosso lado**: a linha continuaria no banco dizendo "conectado", o envio
 * passaria a tomar 404 do provedor, e o sintoma seria silêncio.
 *
 * ## É AQUI que a cobrança começa
 *
 * Esta é a única chamada do projeto que liga uma cobrança recorrente no
 * provedor. Ela fica depois do QR lido de propósito: assinar antes seria pagar
 * por uma instância que a pessoa talvez nunca pareie.
 *
 * `withCalls: false` porque o produto não atende ligação — ele lê e responde
 * mensagem. Ligar suporte a chamada custaria mais por uma capacidade que
 * nenhuma tela usa.
 */
export async function assinarInstancia(instancia: Instancia): Promise<void> {
  const partner = process.env.ZAPI_PARTNER_TOKEN
  if (!partner) throw new Error('ZAPI_PARTNER_TOKEN não configurado.')

  await chamar(comInstancia(instancia, 'integrator/on-demand/subscription'), {
    method: 'POST',
    // O Partner token entra no lugar do `Client-Token`: a documentação diz, em
    // texto, que *"não é necessário enviar o Client-Token nestas requisições"*.
    headers: { Authorization: `Bearer ${partner}` },
    body: { withCalls: false },
  })
}

/**
 * CANCELA a assinatura da instância. É o que faz a cobrança parar.
 *
 * ## Cancelar não apaga na hora, e a diferença precisa estar na tela
 *
 * A documentação é explícita: *"quando uma instância é cancelada, ela permanece
 * ativa até o fim do ciclo de cobrança atual, que corresponde ao último dia do
 * mês. Depois do fim do ciclo, a instância é automaticamente desativada."*
 *
 * Ou seja o número continua funcionando até virar o mês. Para o cliente isso é
 * bom — ele não perde o WhatsApp no dia em que cancela —, e para a nossa fatura
 * significa que o mês corrente já está pago de qualquer jeito.
 *
 * O primeiro corte deste arquivo chamava isto de `apagarInstancia` e batia em
 * `DELETE /partner/instances/{id}`. **Esse endpoint não existe na documentação**
 * — foi inventado, e a lista real de rotas do Partner tem sete entradas, nenhuma
 * delas com essa forma. Conferido em 17/09.
 *
 * ## O método NÃO está publicado, e isso fica escrito em vez de escondido
 *
 * A documentação do cancelamento descreve o efeito e **não publica o método nem
 * o caminho**. O caminho aqui é o simétrico do de assinar, que ESTÁ publicado
 * (`integrator/on-demand/subscription`), e o método é inferido.
 *
 * Por isso a função **tenta DELETE e cai para POST** no 405. Um cancelamento
 * que falha em silêncio é a pior falha deste arquivo: a instância continua na
 * fatura e nenhuma tela sabe. Quem chama trata a exceção e conta como falha —
 * `rodarPurgaDeInstancias` já faz isso e mantém a linha no banco para a
 * varredura do dia seguinte reencontrar.
 *
 * **Uma chamada real contra a conta fecha esta dúvida**, e é o primeiro teste a
 * fazer quando o Partner token existir.
 */
export async function cancelarAssinaturaDaInstancia(instancia: Instancia): Promise<void> {
  const partner = process.env.ZAPI_PARTNER_TOKEN
  if (!partner) throw new Error('ZAPI_PARTNER_TOKEN não configurado.')

  const caminho = comInstancia(instancia, 'integrator/on-demand/subscription')
  const cabecalhos = { Authorization: `Bearer ${partner}` }

  try {
    await chamar(caminho, { method: 'DELETE', headers: cabecalhos })
  } catch (erro) {
    // 405 é "método errado", e é a única falha que vale uma segunda tentativa:
    // ela diz que o caminho existe. Qualquer outro status sobe, porque tentar
    // de novo com outro verbo esconderia um 401 ou um 404 de verdade.
    if (erro instanceof ZapiError && erro.status === 405) {
      await chamar(caminho, { method: 'POST', headers: cabecalhos })
      return
    }
    throw erro
  }
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
  // ## `qr-code/image`, COM hifen, e eu quase quebrei isto "consertando"
  //
  // Medido contra a conta real em 17/09, e os dois caminhos respondem 200:
  //
  //     GET /qr-code/image   7.214 bytes, {"value":"data:image/png;base64,..."}
  //     GET /qrcode/image    {"error":"NOT_FOUND"}  <- 200 com erro no CORPO
  //
  // Horas antes eu tinha trocado para a versao sem hifen, lendo a documentacao:
  // o nome da pagina da Z-API e `qr-code-image`, e eu conclui que o hifen era do
  // documento e nao do endpoint. **Era do endpoint.**
  //
  // O que torna esse erro pior que um 404: a Z-API devolve **200 com erro no
  // corpo**. `resposta.ok` e `true`, o JSON entra, nenhum campo de imagem
  // existe, e a funcao devolve `null` — a tela diria "nao foi possivel gerar o
  // QR" sem nada no log. Silencio, de novo.
  //
  // A licao nao e sobre o hifen. E que a documentacao desta API foi FONTE
  // ERRADA cinco vezes hoje, e a API real e a unica autoridade.
  const r = await chamar<{
    value?: string
    // A documentacao descreve a resposta como "o QRCode em base64" e NAO
    // publica o nome do campo. `value` e o padrao da casa (o `/disconnect` e os
    // tres webhooks usam), e os outros dois nomes estao aqui porque um `<img>`
    // com `undefined` dentro nao mostra erro nenhum: so um quadrado quebrado.
    qrcode?: string
    base64?: string
    connected?: boolean
    challenge?: unknown
  }>(comInstancia(instancia, 'qr-code/image'), {
    headers: { 'Client-Token': clientToken() },
  })

  if (r.connected) return null
  if (r.challenge) return null

  const imagem = r.value ?? r.qrcode ?? r.base64
  return typeof imagem === 'string' && imagem.length > 0 ? imagem : null
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
 * Aponta os TRES webhooks desta instancia para as rotas deste produto.
 *
 * ## O defeito que isto conserta, achado parenado um numero de verdade (18/09)
 *
 * A versao anterior chamava `update-every-webhooks` com a URL BASE:
 *
 *     PUT /update-every-webhooks   { value: "https://.../api/webhooks/zapi" }
 *
 * Ela responde **200**, e aponta os quatro eventos para um caminho que **nao
 * tem rota**: as tres deste produto vivem em `/receive/{segredo}`,
 * `/status/{segredo}` e `/disconnected/{segredo}`, e o segredo E a identidade
 * da empresa. Sem ele nao ha para onde entregar.
 *
 * O sintoma foi exatamente o previsto no comentario que estava aqui: o numero
 * pareou na Z-API (`connected: true`), e o banco continuou dizendo
 * `conectando`, porque o webhook de status nunca chegou. **Silencio, com a
 * tela dizendo uma coisa e o provedor dizendo outra.**
 *
 * ## Os caminhos certos, medidos contra a API real
 *
 *     update-webhook-received         200 {"value":true}
 *     update-webhook-message-status   200 {"value":true}
 *     update-webhook-disconnected     200 {"value":true}
 *
 * E o mesmo aprendizado de 25/08 e de 17/09 pela terceira vez: a documentacao
 * da Z-API descreve o CORPO e o EFEITO, e frequentemente nao publica o caminho.
 * Quem decide e o status HTTP contra a conta real.
 *
 * ## Um PUT por evento, e nao um que faz tudo
 *
 * `update-every-webhooks` define UMA url para todos. Aqui cada evento precisa
 * de uma url diferente, porque a rota carrega o tipo. O endpoint que faz tudo
 * de uma vez so serviria se as tres fossem iguais, e elas nao sao.
 *
 * ## Continua devolvendo se deu certo, em vez de afirmar
 *
 * `Promise.allSettled` e nao `all`: o interessante e quantos apontaram, e um
 * que falha nao deve esconder os demais. O chamador mostra as URLs de
 * qualquer jeito, para a pessoa colar no painel.
 *
 * E a licao de 12/09 continua valendo: `sendButtons` respondeu 201 quatro vezes
 * sem renderizar nada. **Aceitar nao e entregar** — o que fecha de verdade e
 * uma mensagem real chegando na caixa.
 */
export async function tentarConfigurarWebhooks(
  instancia: Instancia,
  urls: { recebida: string; status: string; desconexao: string },
): Promise<{ confirmado: boolean; motivo?: string }> {
  const alvos = [
    { caminho: 'update-webhook-received', url: urls.recebida },
    // ## O MESMO destino, por um segundo endpoint, e nao e redundancia
    //
    // `receiveCallbackSentByMe` e o que faz a mensagem escrita no CELULAR do
    // dono voltar para o CRM. Sem ela a caixa mostra as perguntas do cliente
    // **sem nenhuma resposta ao lado**, e a pessoa conclui que o produto perdeu
    // o que ela escreveu.
    //
    // Quem liga essa flag e ESTE endpoint. Medido contra a conta real em 18/09,
    // lendo `GET /me` depois de cada escrita:
    //
    //     update-webhook-received   { notifySentByMe: true }   flag continua FALSE
    //     update-webhook-received-delivery                     flag vira TRUE
    //
    // Ou seja, `notifySentByMe` e aceito com 200 e **ignorado em silencio**.
    // Terceira vez que esta API responde 200 sem fazer o que o corpo pede.
    { caminho: 'update-webhook-received-delivery', url: urls.recebida },
    { caminho: 'update-webhook-message-status', url: urls.status },
    { caminho: 'update-webhook-disconnected', url: urls.desconexao },
  ] as const

  const resultados = await Promise.allSettled(
    alvos.map((alvo) =>
      chamar(comInstancia(instancia, alvo.caminho), {
        method: 'PUT',
        headers: { 'Client-Token': clientToken() },
        body: { value: alvo.url },
      }),
    ),
  )

  const falhas = resultados
    .map((r, i) => ({ r, alvo: alvos[i]! }))
    .filter(({ r }) => r.status === 'rejected')

  if (falhas.length === 0) return { confirmado: true }

  const motivo = falhas
    .map(({ r, alvo }) => {
      const erro = (r as PromiseRejectedResult).reason
      return erro instanceof ZapiError
        ? `${alvo.caminho}: ${erro.status}`
        : `${alvo.caminho}: ${String(erro).slice(0, 60)}`
    })
    .join(' | ')

  console.error('tentarConfigurarWebhooks: nao confirmado', motivo)
  return { confirmado: false, motivo }
}

export async function desconectar(instancia: Instancia): Promise<void> {
  // ## GET, e a API real derrubou a minha "correcao" aqui tambem
  //
  //     GET  /disconnect   200 {"value":true}
  //     POST /disconnect   405 Method Not Allowed
  //
  // Horas antes eu tinha trocado para POST, porque a documentacao diz
  // "verifique se voce enviou POST ou GET" — frase generica que aparece na
  // secao de erro de TODA pagina, e que eu li como especificacao.
  //
  // Medido contra a conta real em 17/09. `chamar` cai em GET sem `method`, que
  // e o certo aqui.
  await chamar(comInstancia(instancia, 'disconnect'), {
    headers: { 'Client-Token': clientToken() },
  })
}

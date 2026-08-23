import 'server-only'

import { EvolutionApiError, evolutionFetch } from './client'

/**
 * As operações do Evolution GO que este produto usa.
 *
 * ## Evolution GO, não Evolution API (Node/Baileys)
 *
 * A VPS roda `github.com/EvolutionAPI/evolution-go`, reescrita em Go sobre
 * `whatsmeow` — confirmado lendo o Swagger real do servidor (`/swagger/doc.json`)
 * em 21/08. É outra API: rotas diferentes, dois níveis de credencial em vez
 * de um.
 *
 * ## As duas credenciais, testadas contra o servidor real
 *
 * `GLOBAL_API_KEY` (env `EVOLUTION_API_KEY`) só abre rotas ADMINISTRATIVAS —
 * criar instância, listar todas, apagar. Testado: usá-la em `/instance/connect`
 * devolve `401 not authorized`.
 *
 * Cada instância tem seu PRÓPRIO token, escolhido no momento da criação
 * (`criarInstancia` gera um). Esse token é o que autentica toda operação
 * SOBRE a instância — conectar, ler QR, status, enviar mensagem — indo no
 * mesmo header `apikey`, só que com valor diferente. Por isso quase toda
 * função aqui recebe `tokenDaInstancia` além do nome/id.
 *
 * ## O que NÃO existe aqui, de propósito
 *
 * Não há função de disparo em massa. `enviarTexto` manda para **um** número
 * por chamada. Isso não é regra de conduta pedida ao usuário: é ausência de
 * superfície — se a funcionalidade não existe no código, ninguém consegue
 * usar o Velo Funil para disparar em massa, e disparo em massa é a causa
 * número um de banimento.
 */

/** O estado de uma conexão, normalizado a partir do formato do Evolution GO. */
export type EstadoDaConexao = 'open' | 'connecting' | 'close'

export type Instancia = {
  id: string
  nome: string
  /** Token que autentica as próximas chamadas sobre ESTA instância. Guardar cifrado. */
  token: string
}

export type EstadoDeInstancia = {
  estado: EstadoDaConexao
  numero: string | null
}

/**
 * Cria a instância no Evolution GO.
 *
 * `instanceId` precisa ser um UUID de verdade — testado: string livre
 * devolve `500` do Postgres por trás (`invalid input syntax for type uuid`).
 * `workspaceId` já É um UUID, então serve direto.
 *
 * O `token` nasce aqui, escolhido por nós (não o Evolution) — vira a senha
 * de acesso desta instância específica, e precisa ser guardado cifrado
 * (mesma coluna `access_token_enc` que as outras integrações já usam).
 */
export async function criarInstancia(
  instanceId: string,
  nome: string,
  token: string,
): Promise<Instancia> {
  await evolutionFetch<unknown>('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceId, name: nome, token }),
  })

  return { id: instanceId, nome, token }
}

/**
 * Conecta a instância e devolve o QR Code para leitura.
 *
 * O QR expira em ~20 segundos e o Evolution gera outro sozinho, então ele
 * **nunca é guardado** — a tela busca ao vivo enquanto o diálogo está
 * aberto.
 *
 * `webhookUrl` vai NESTA chamada, não numa rota separada de webhook — o
 * Evolution GO não tem `/webhook/set` como a Evolution API original.
 *
 * `/instance/connect` NÃO devolve o QR Code no corpo — testado contra o
 * servidor real: a resposta só tem `eventString`/`jid`/`webhookUrl`. O QR
 * mora em `/instance/qr`, uma chamada separada logo em seguida. Sem essa
 * segunda chamada, a tela ficava presa em "Não consegui gerar o código" —
 * `conectarInstancia` sempre devolvia `qrCode: null` mesmo com sucesso.
 */
export async function conectarInstancia(
  tokenDaInstancia: string,
  webhookUrl: string,
): Promise<{ qrCode: string | null; jaConectado: boolean }> {
  await evolutionFetch(
    '/instance/connect',
    {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl,
        // Espelha o que a Evolution API original assinava: mensagem
        // recebida e mudança de estado da conexão. Nada de presença
        // ("digitando"), que multiplicaria o volume sem virar informação.
        subscribe: ['MESSAGE', 'CONNECTION'],
      }),
    },
    tokenDaInstancia,
  )

  const qrCode = await esperarQrCode(tokenDaInstancia)
  if (qrCode) return { qrCode, jaConectado: false }

  // Ficar sem QR depois da espera tem duas causas OPOSTAS, e confundi-las é o
  // que fazia a tela mentir: ou a sessão ainda não subiu (tentar de novo
  // resolve), ou o número já está pareado e por isso não há QR nenhum para
  // mostrar (tentar de novo nunca resolveria). Só o estado separa as duas.
  const { estado } = await obterEstado(tokenDaInstancia)
  return { qrCode: null, jaConectado: estado === 'open' }
}

/**
 * Busca um QR novo para uma instância que ainda não foi conectada.
 *
 * Devolve `null` — em vez de estourar — quando o servidor responde
 * `400 {"error":"no QR code available. Please wait a moment and try again"}`.
 * Isso NÃO é falha: é o Evolution dizendo que a sessão ainda está subindo. O
 * código antigo tratava como erro e o texto cru do servidor aparecia em
 * vermelho na tela de conexão, com um botão "Tentar de novo" que a pessoa
 * precisava apertar para fazer o que o próprio servidor tinha acabado de
 * pedir. Ver `esperarQrCode`.
 *
 * Só o 400 é engolido: token errado devolve 401 e instância inexistente
 * devolve 404, e esses dois continuam subindo como erro de verdade.
 */
export async function obterQrCode(tokenDaInstancia: string): Promise<string | null> {
  try {
    const resposta = await evolutionFetch<{ data?: { qrcode?: string } }>(
      '/instance/qr',
      undefined,
      tokenDaInstancia,
    )
    return resposta?.data?.qrcode ?? null
  } catch (err) {
    if (err instanceof EvolutionApiError && err.status === 400) return null
    throw err
  }
}

/**
 * Espera o QR ficar disponível, mas por pouco tempo — e o motivo importa.
 *
 * `/instance/connect` responde 200 assim que ACEITA o pedido, não quando a
 * sessão está pronta: o pareamento leva segundos. Pedir o QR no instante
 * seguinte pega a janela em que ele ainda não existe, e era esse o defeito
 * original.
 *
 * Mas a primeira correção errou para o outro lado, esperando até 12s DENTRO da
 * Server Action. Medido no servidor real em 23/08, cada `/instance/qr` custa
 * ~3s; somando com a latência da rota, a requisição do navegador ficava
 * pendurada tempo demais e o próprio navegador desistia — o que aparece para a
 * pessoa como "verifique a conexão e tente novamente", uma mensagem que não é
 * nossa e que não diz nada sobre o que houve.
 *
 * Quem espera passou a ser a TELA, que já busca o QR sozinha a cada poucos
 * segundos e sabe mostrar "preparando o código" enquanto isso. Aqui ficam
 * apenas duas tentativas: se o QR já estiver pronto (caso comum quando a
 * instância existe), a pessoa o recebe na mesma resposta e nada pisca.
 */
export async function esperarQrCode(
  tokenDaInstancia: string,
  limiteMs = 4_000,
): Promise<string | null> {
  const prazo = Date.now() + limiteMs

  for (;;) {
    const qr = await obterQrCode(tokenDaInstancia)
    if (qr) return qr
    if (Date.now() >= prazo) return null
    await new Promise((resolve) => setTimeout(resolve, 600))
  }
}

/**
 * O estado da conexão.
 *
 * O Evolution GO devolve `Connected`/`LoggedIn` capitalizados (convenção Go),
 * confirmado no servidor real — diferente do `state: "open"/"close"` da
 * Evolution API original. Normaliza para o vocabulário que o resto do
 * projeto já usa.
 */
export async function obterEstado(tokenDaInstancia: string): Promise<EstadoDeInstancia> {
  const resposta = await evolutionFetch<{
    data?: { Connected?: boolean; LoggedIn?: boolean; Name?: string }
  }>('/instance/status', undefined, tokenDaInstancia)

  const dados = resposta?.data
  const estado: EstadoDaConexao =
    dados?.Connected && dados?.LoggedIn ? 'open' : dados?.Connected ? 'connecting' : 'close'

  return { estado, numero: dados?.Name || null }
}

/**
 * Último erro que o servidor registrou para esta instância.
 *
 * Existe porque o erro que a instância devolve na porta da frente não diz
 * nada: `/instance/qr` responde sempre o mesmo
 * `no QR code available. Please wait a moment and try again`, seja a sessão
 * ainda subindo (transitório, resolve sozinho) ou o servidor incapaz de criar
 * a sessão (permanente, ninguém resolve esperando). Foi o que aconteceu em
 * 22/08: 20 tentativas ao longo de 134s, sempre o mesmo 400, enquanto o log
 * do servidor dizia a causa em texto claro —
 * `pq: sorry, too many clients already`, o Postgres da VPS sem conexão livre
 * para o whatsmeow criar o store da instância.
 *
 * Rota administrativa: usa a `GLOBAL_API_KEY`, não o token da instância
 * (testado, com o token da instância devolve `not authorized`).
 *
 * Nunca estoura: isto roda no caminho de falha, e um erro aqui só trocaria um
 * diagnóstico ruim por um pior.
 */
export async function ultimoErroDaInstancia(instanceId: string): Promise<string | null> {
  try {
    const linhas = await evolutionFetch<Array<{ level?: string; message?: string }>>(
      `/instance/logs/${encodeURIComponent(instanceId)}`,
    )
    return (linhas ?? []).find((l) => l.level === 'ERROR')?.message ?? null
  } catch {
    return null
  }
}

/**
 * Começa uma sessão de pareamento genuinamente nova.
 *
 * ## O defeito, lido no log de uma tentativa real (23/08)
 *
 * O Evolution GO gera no máximo 6 QR codes por sessão e então mata tudo:
 * `QR timeout — signaling kill channel`, seguido de `Received kill signal`.
 * Medido numa tentativa real: primeiro QR às 19:26:59, corte às 19:29:39 —
 * **160 segundos**. Depois disso a tela seguia exibindo o código de uma sessão
 * que já não existia, e escanear devolvia "verifique sua conexão e tente mais
 * tarde" — mensagem do WhatsApp, não nossa, o que torna o rastro difícil de
 * seguir até aqui.
 *
 * ## Por que apagar a instância, e não algo mais suave
 *
 * Três saídas testadas contra o servidor real, e as duas primeiras FALHAM:
 *
 *   `/instance/connect` de novo    -> "Instance already running, settings
 *                                      updated without restarting client"
 *   `/instance/disconnect`+connect -> mesma coisa. `disconnect` só derruba
 *                                      número JÁ pareado; num pareamento que
 *                                      nunca completou não há o que desconectar
 *   apagar + criar + conectar      -> QR diferente e contador de volta ao #1
 *
 * A instância é recriada com o MESMO `instanceId` e o MESMO token, então nada
 * muda para o resto do sistema: o `webhookUrl` continua apontando para o mesmo
 * lugar e a linha de `integration_connections` segue válida.
 *
 * Só faz sentido enquanto o pareamento não completou. Depois de conectado,
 * apagar a instância derrubaria o número — quem chama confere o estado antes.
 */
export async function recomecarSessaoDePareamento(
  instanceId: string,
  nome: string,
  token: string,
  webhookUrl: string,
): Promise<string | null> {
  await apagarInstancia(instanceId)

  // O servidor precisa de um instante para liberar o id antes de aceitá-lo de
  // volta; sem a pausa o `create` pode colidir com a instância em remoção.
  await new Promise((resolve) => setTimeout(resolve, 1_500))

  await criarInstancia(instanceId, nome, token)
  await evolutionFetch(
    '/instance/connect',
    {
      method: 'POST',
      body: JSON.stringify({ webhookUrl, subscribe: ['MESSAGE', 'CONNECTION'] }),
    },
    token,
  )

  return esperarQrCode(token)
}

/**
 * Pede um código de pareamento em vez de QR Code.
 *
 * ## Por que existe, e por que é o caminho melhor
 *
 * O QR do WhatsApp vive ~20 segundos e a sessão inteira morre em ~160s
 * (6 códigos), o que abre uma janela estreita entre "o código aparece na tela"
 * e "o celular consegue lê-lo". Foi ali que as tentativas reais falharam, com
 * o WhatsApp respondendo "verifique sua conexão e tente mais tarde".
 *
 * O código de pareamento não tem nenhum desses problemas: são 8 letras
 * (`6VHM-7PC7`), digitadas à mão, com validade bem mais folgada. Não depende
 * de câmera, de foco, nem de a pessoa estar com o celular na frente do
 * monitor — o que também resolve quem acessa o CRM pelo próprio celular e não
 * tinha como escanear a tela dele mesmo.
 *
 * Testado contra o servidor real em 23/08: `POST /instance/pair` responde
 * `{"data":{"PairingCode":"6VHM-7PC7"},"message":"success"}`.
 *
 * O número precisa vir só com dígitos e DDI (`5511988887777`) — quem chama
 * normaliza com `normalizarTelefoneBrasileiro`, a mesma validação que o botão
 * "Chamar no WhatsApp" já usa.
 */
export async function pedirCodigoDePareamento(
  tokenDaInstancia: string,
  telefoneComDdi: string,
): Promise<string | null> {
  const resposta = await evolutionFetch<{ data?: { PairingCode?: string } }>(
    '/instance/pair',
    {
      method: 'POST',
      body: JSON.stringify({
        phone: telefoneComDdi,
        subscribe: ['MESSAGE', 'CONNECTION'],
      }),
    },
    tokenDaInstancia,
  )

  return resposta?.data?.PairingCode ?? null
}

/** Desconecta o número sem apagar a instância — dá para reconectar depois. */
export async function desconectar(tokenDaInstancia: string): Promise<void> {
  await evolutionFetch('/instance/disconnect', { method: 'POST' }, tokenDaInstancia)
}

/**
 * Apaga a instância de vez.
 *
 * Rota administrativa (usa `GLOBAL_API_KEY`, não o token da instância) —
 * quem cria/apaga instância é o servidor, não o dono do número.
 */
export async function apagarInstancia(instanceId: string): Promise<void> {
  await evolutionFetch(`/instance/delete/${encodeURIComponent(instanceId)}`, { method: 'DELETE' })
}

/**
 * Manda uma mensagem de texto para UM número.
 *
 * ## Por que o atraso de digitação não é enfeite
 *
 * `delay` faz o Evolution mostrar "digitando..." antes de enviar, e é uma das
 * coisas que a Meta observa para separar humano de robô: mensagem que sai no
 * milissegundo seguinte ao gatilho tem assinatura de automação. O padrão de
 * 1,2s é proporcional a uma frase curta digitada por pessoa.
 *
 * Não torna o envio seguro — só remove um sinal óbvio.
 */
export async function enviarTexto(
  tokenDaInstancia: string,
  numero: string,
  texto: string,
  delayMs = 1200,
): Promise<{ id: string | null }> {
  const resposta = await evolutionFetch<{ data?: { id?: string } }>(
    '/send/text',
    {
      method: 'POST',
      body: JSON.stringify({ number: numero, text: texto, delay: delayMs }),
    },
    tokenDaInstancia,
  )

  return { id: resposta?.data?.id ?? null }
}

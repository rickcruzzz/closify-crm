import 'server-only'

import { evolutionFetch } from './client'

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
): Promise<{ qrCode: string | null }> {
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

  const qrCode = await obterQrCode(tokenDaInstancia)
  return { qrCode }
}

/** Busca um QR novo para uma instância que ainda não foi conectada. */
export async function obterQrCode(tokenDaInstancia: string): Promise<string | null> {
  const resposta = await evolutionFetch<{ data?: { qrcode?: string } }>(
    '/instance/qr',
    undefined,
    tokenDaInstancia,
  )
  return resposta?.data?.qrcode ?? null
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

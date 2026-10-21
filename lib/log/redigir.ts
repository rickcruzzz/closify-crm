/**
 * O que pode ir para o log, e o que não pode.
 *
 * ## Por que isto existe
 *
 * Seis linhas de `console.error` mandavam telefone COMPLETO de cliente e de
 * prospect para o log da Vercel, e três mandavam o corpo cru da resposta do
 * provedor. Duas coisas erradas ao mesmo tempo:
 *
 * **Telefone é dado pessoal sob LGPD**, e o log da Vercel não é o sistema onde
 * ele foi consentido. Pior no caso do prospect: titular que nunca teve relação
 * nenhuma com o produto. E o log fica FORA de toda purga — as rotinas de
 * `limpar-eventos` alcançam tabela, não log.
 *
 * **O corpo do erro em 401/403 é onde o token aparece.** Provedor que recusa
 * credencial costuma ecoar a requisição, e `remetenteZapi` logava `erro.corpo`
 * exatamente nesse ramo, sem redator nenhum.
 *
 * ## O log continua servindo para o que ele serve
 *
 * Quem lê um log de erro quer CORRELACIONAR duas linhas e saber de qual
 * instância veio, não ligar para a pessoa. O que fica é suficiente para as
 * duas coisas e insuficiente para a terceira.
 */

/**
 * Telefone com o meio apagado: país e DDD ficam, o número some.
 *
 *     557185040900   ->   5571****00
 *
 * O começo identifica a praça e a instância, que é o que separa "o webhook de
 * uma empresa está falhando" de "está falhando para todo mundo". Os dois
 * últimos dígitos deixam correlacionar duas linhas do mesmo incidente sem
 * reconstituir o número.
 */
export function telefoneNoLog(telefone: string | null | undefined): string {
  const d = String(telefone ?? '').replace(/\D/g, '')
  if (d.length < 8) return '(sem telefone)'
  return `${d.slice(0, 4)}${'*'.repeat(Math.max(0, d.length - 6))}${d.slice(-2)}`
}

/**
 * O teto de caracteres do corpo de erro.
 *
 * Generoso o bastante para a mensagem do provedor caber inteira, curto o
 * bastante para não despejar um HTML de página de erro no log.
 */
const TETO_DO_CORPO = 300

/**
 * Sequências que parecem credencial. O alvo não é um formato específico: é
 * qualquer coisa longa e sem espaço, que é a forma de todo token.
 *
 * Erra para o lado de apagar demais, de propósito. Um id apagado custa uma
 * investigação um pouco mais longa; um token vazado custa a conta.
 *
 * ## `+`, `/` e `=` entraram depois, e a falta deles vazava pedaço
 *
 * A primeira classe era `[A-Za-z0-9_\-.]`, e ela parava no `+` de um base64.
 * Medido: `aGVsbG8rd29ybGQvdGhpcytpcytiYXNlNjQ=aGVsbG8rd29ybGQ=` saía com o
 * primeiro trecho oculto e `aGVsbG8rd29ybGQ=` inteiro ao lado — um segredo
 * picado em pedaços legíveis é um segredo vazado, só que mais difícil de
 * perceber.
 *
 * `:` e `/` também entraram, e com eles uma URL inteira passa a ser ocultada.
 * Isso é o comportamento CERTO aqui: neste produto a URL da Z-API é
 * `/instances/{id}/token/{token}/{endpoint}`, ou seja o caminho É a
 * credencial. Ver `caminhoNoLog`.
 */
const PARECE_SEGREDO = /[A-Za-z0-9_\-.+/=:~]{24,}/g

/**
 * Corpo de resposta de provedor, pronto para o log.
 *
 * Corta no teto e apaga o que parece credencial. `JSON.stringify` não entra
 * aqui de propósito: o corpo chega como string do `fetch`, e reparseá-lo só
 * para reimprimir acrescentaria um caminho de falha.
 */
export function corpoDeErroNoLog(corpo: string | null | undefined): string {
  if (!corpo) return '(sem corpo)'
  return corpo.slice(0, TETO_DO_CORPO).replace(PARECE_SEGREDO, '[oculto]')
}

/**
 * O caminho de uma requisição ao provedor, sem a credencial que mora nele.
 *
 * ## O vazamento que isto fecha, e ele estava ao lado do que eu já tinha
 * ## consertado
 *
 * `comInstancia` (`lib/whatsapp/zapi.ts:170`) monta
 *
 *     /instances/{instanceId}/token/{token}/{endpoint}
 *
 * ou seja **o token da instância faz parte do caminho**. E
 * `remetente-zapi.ts:111` logava `erro.caminho` cru, na linha imediatamente
 * abaixo do `erro.corpo` que já passava pelo redator.
 *
 * O token de instância da Z-API manda mensagem em nome do número do cliente.
 * Ele no log da Vercel é a credencial mais cara que este produto tem, depois
 * da service role.
 *
 * ## O que sobra é o que serve para investigar
 *
 *     /instances/3F95055E.../token/ABC.../send-text
 *     ->  /instances/3F95055E/token/[oculto]/send-text
 *
 * O começo do `instanceId` continua distinguindo uma empresa da outra, e o
 * endpoint continua dizendo qual chamada falhou — que são as duas perguntas
 * que alguém faz olhando este log.
 */
export function caminhoNoLog(caminho: string | null | undefined): string {
  if (!caminho) return '(sem caminho)'
  return caminho
    .replace(/\/token\/[^/?]+/g, '/token/[oculto]')
    .replace(/\/instances\/([^/?]{0,8})[^/?]*/g, '/instances/$1')
}

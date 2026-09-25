/**
 * Quando a resposta do provedor é um VEREDITO sobre a instância, e quando ela
 * é só "tente de novo".
 *
 * ## Por que isto é um módulo à parte
 *
 * `conferir-conexao.ts` importa `server-only`, o que impede o Vitest de
 * carregá-lo. A decisão aqui é pura e decide se a conexão de um cliente cai,
 * então ela precisa de teste — mesmo desenho de `lib/conversas/aquecimento.ts`
 * e de `lib/plans/trial.ts`: o que decide fica separado do que faz I/O.
 *
 * ## A lista é FECHADA, e a primeira versão era uma faixa
 *
 * Ela dizia "4xx é veredito, 5xx é não sei". Larga demais: **429 é 4xx e
 * significa tente de novo**, e é justamente o status que uma empresa enviando
 * muito recebe.
 *
 * Derrubar por ele percorreria o caminho inteiro do estrago: o sino avisa a
 * empresa toda que o WhatsApp caiu, o relógio da purga (0091) começa a contar
 * sete dias até apagar a instância no provedor, e a pessoa refaz o pareamento
 * lendo um QR no celular. Por um limite de taxa que passa em um minuto.
 *
 * O número em risco é o DO CLIENTE, que é o mesmo argumento da escada de
 * aquecimento.
 *
 *     401 403        credencial revogada: esta instância não é mais nossa
 *     404            o provedor não conhece mais esta instância
 *     400            assinatura vencida, que é como a Z-API responde
 *                    "you must subscribe to this instance again", medido em 23/09
 *     408 425 429    TENTE DE NOVO. Não é resposta sobre a instância
 *     5xx / rede     o provedor não conseguiu responder
 *
 * Status novo do provedor entra aqui depois de alguém decidir o que ele
 * significa, e não por cair numa faixa.
 */
export const STATUS_QUE_DECIDEM = new Set([400, 401, 403, 404])

/** O provedor está dizendo que esta instância não vale mais? */
export function ehVeredito(status: number): boolean {
  return STATUS_QUE_DECIDEM.has(status)
}

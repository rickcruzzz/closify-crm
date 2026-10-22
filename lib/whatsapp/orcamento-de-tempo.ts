/**
 * Quanto cada ida à Z-API pode durar DENTRO de uma Server Action.
 *
 * ## O defeito que isto fecha (22/10): "Adotar instância" girando para sempre
 *
 * A produção saiu da Vercel para a **Netlify**, e lá a função tem ~10s por
 * padrão. O teto genérico de `zapi.ts` é 8s por chamada — certo para uma rota
 * de webhook, que faz UMA ida —, e as Actions daqui encadeiam duas ou três:
 *
 *     adotarInstancia      status, webhooks                  8 + 8     = 16s
 *     lerQrCode conectou   status, assinar, device           8 + 8 + 8 = 24s
 *     conectarWhatsapp     criar, status, qr (via lerQrCode) 8 + 8 + 8 = 24s
 *
 * Passou de dez, a plataforma mata a função, a Action REJEITA no navegador, e
 * a tela fica com o spinner ligado e nenhum toast. Nenhum log do nosso lado.
 *
 * ## A conta que estes números fecham
 *
 * Alvo: pior caso ABAIXO de ~9s, com ~2s reservados para o Supabase (sessão,
 * plano, leitura e escrita da conexão). Sobram ~7s de Z-API, divididos pelo
 * número de etapas EM SÉRIE de cada Action — as paralelas contam uma vez. A
 * conta de cada Action fica no comentário dela, ao lado do código que ela
 * descreve, e não aqui: mudar uma etapa sem ver a conta é como ela quebra.
 *
 * As chamadas medidas em 17/09 respondem bem abaixo de um segundo. Quem passa
 * de 2,5s está com problema, e esperar mais não o resolve: devolve o tempo para
 * a tela dizer a verdade.
 */
export const TIMEOUT_NA_ACTION_MS = 2_500

/**
 * Criar instância ganha mais, e o motivo é dinheiro.
 *
 * Desistir de uma criação que a Z-API ainda vai concluir deixa uma instância
 * sem linha nenhuma apontando para ela. Ela nasce em trial e o provedor a apaga
 * em 48h, então não fatura — mas quanto menos isso acontecer, melhor, e a
 * criação é a única chamada daqui que provisiona algo.
 */
export const TIMEOUT_PARA_CRIAR_MS = 3_500

/**
 * A chamada morreu por TEMPO, e não por recusa?
 *
 * A diferença muda a frase da tela. Antes, todo erro do `GET /status` virava
 * *"A Z-API não reconheceu este ID e token"* — e quem colou as credenciais
 * certas ia conferir o painel por nada, quando bastava tentar de novo.
 *
 * `AbortError` é o que o `fetch` lança quando o `AbortController` de `chamar`
 * dispara; `TimeoutError` é o de `AbortSignal.timeout`, aceito para não
 * depender de qual dos dois o transporte usar amanhã.
 */
export function estourouOTempo(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false
  const nome = (erro as { name?: unknown }).name
  return nome === 'AbortError' || nome === 'TimeoutError'
}

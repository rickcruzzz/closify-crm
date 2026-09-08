/**
 * O que a Central sabe sobre a conta do Google Ads, sem falar com ninguém.
 *
 * ## Por que só agora, e por que aqui
 *
 * O developer token ficou em "conta de teste" de 06 a 08/09, e token de teste
 * **não lê conta de produção** — a API respondia `403
 * DEVELOPER_TOKEN_NOT_APPROVED`. Até então a única leitura possível era dirigir
 * o navegador, o que custou uma sessão inteira e não sobrevive a mudança de
 * layout do painel.
 *
 * Aprovado em 08/09 e provado no mesmo dia: `customer.test_account = false`
 * numa consulta que devolveu a campanha real. É essa flag que separa "o token
 * responde" de "o token responde sobre a conta que gasta dinheiro".
 *
 * Mora em `lib/dono/` e não em `lib/analytics/` porque isto é a Central do
 * dono: leitura da conta de anúncio. `lib/analytics/` é o que roda no produto,
 * para o cliente.
 *
 * ## Puro de propósito, e a divisão tem uma razão prática
 *
 * Este arquivo não importa `server-only` e não fala com a rede — quem faz isso
 * é `google-ads-queries.ts`. É o mesmo desenho de `trial.ts` e
 * `trial-queries.ts`, e ele existe porque `server-only` **impede o teste de
 * importar o módulo**: a conversão de micros e a decisão de conversão offline
 * são justamente o que precisa de teste, e ficariam sem.
 *
 * ## O `login-customer-id` NÃO é enviado, e isso é medição e não descuido
 *
 * `GOOGLE_ADS_LOGIN_CUSTOMER_ID` existe no `.env.local` e aponta para a MCC
 * `534-629-0307`. Medido em 08/09, na mesma consulta:
 *
 *     sem login-customer-id   HTTP 200
 *     com login-customer-id   HTTP 403
 *
 * A conta `jonatqpedro` deu acesso à conta de anúncio ao `henriquestn24`, dono
 * do projeto no Cloud — mas **não à MCC**. Mandar o cabeçalho faz o Google
 * validar permissão sobre um administrador que este refresh token não alcança.
 *
 * O `estado-atual` previa isso em 06/09; aqui está provado. Quem mexer neste
 * arquivo depois: ler a variável e mandá-la parece o certo e quebra tudo.
 */

export type CampanhaDoGoogle = {
  id: string
  nome: string
  status: string
  /** Em reais. O Google devolve micros, e a conversão é feita aqui. */
  orcamentoDiario: number
  impressoes: number
  cliques: number
  custo: number
  conversoes: number
  /** `null` quando não houve clique — dividir por zero produziria `Infinity`. */
  cpcMedio: number | null
  ctr: number | null
}

export type PalavraDoGoogle = {
  texto: string
  correspondencia: string
  status: string
  impressoes: number
  cliques: number
  custo: number
  /** `null` sem impressão: 0/0 não é "CTR zero", é "não sei". */
  ctr: number | null
}

export type AcaoDeConversao = {
  nome: string
  status: string
  /** `WEBPAGE` mede no site; `UPLOAD_CLICKS` é o que aceita conversão offline. */
  tipo: string
  categoria: string
  contagem: string
  janelaDeCliqueEmDias: number
}

export type RedesDaCampanha = {
  pesquisaDoGoogle: boolean
  /** Ligado, gasta em sites de terceiros sem dizer de onde veio o clique. */
  parceirosDePesquisa: boolean
  /** Ligado, come o orçamento com clique de aplicativo e jogo. */
  display: boolean
}

export type DesempenhoDoGoogle = {
  conta: { id: string; nome: string; ehContaDeTeste: boolean; moeda: string }
  campanhas: CampanhaDoGoogle[]
  palavras: PalavraDoGoogle[]
  conversoes: AcaoDeConversao[]
  redes: RedesDaCampanha | null
  /** Existe alguma ação capaz de receber conversão offline? Ver `podeImportarConversao`. */
  podeImportarConversao: boolean
}

/**
 * Micros para reais.
 *
 * O Google devolve dinheiro em milionésimos da unidade da conta. Esquecer a
 * divisão não produz erro — produz um número mil vezes maior, com cara de
 * medição. Puro e testado por isso.
 */
export function reaisDeMicros(micros: unknown): number {
  // `unknown` e nao `number | string`: o JSON do Google devolve micros como
  // STRING (para nao perder precisao em valores grandes), e o corpo da resposta
  // e tipado como `Record<string, unknown>`. Estreitar aqui, num lugar so, e
  // melhor que espalhar `as string` por cada campo de dinheiro.
  const n = typeof micros === 'string' ? Number(micros) : typeof micros === 'number' ? micros : 0
  return Number.isFinite(n) ? n / 1_000_000 : 0
}

/**
 * Divisão que devolve `null` em vez de `Infinity` ou `NaN`.
 *
 * Sem isto, uma palavra com 0 impressões daria `NaN` e a tela mostraria "NaN%".
 * E "0%" seria pior que `null`: com zero impressão não existe CTR zero, existe
 * ausência de dado — a mesma distinção que o vigia faz desde 01/09 entre "está
 * zerado" e "não sei".
 */
export function divisaoSegura(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return a / b
}

/**
 * Só `UPLOAD_CLICKS` aceita importação de conversão offline.
 *
 * A ação atual da conta é `WEBPAGE` (medida em 08/09), que mede no site e
 * **recusa** upload. É por isso que o elo pagamento → Google Ads não existe
 * ainda: não é falta de token, é falta de uma ação do tipo certo.
 */
export function podeImportarConversao(acoes: { tipo: string; status: string }[]): boolean {
  return acoes.some((a) => a.tipo === 'UPLOAD_CLICKS' && a.status === 'ENABLED')
}

/**
 * O escopo que o Google concedeu de fato atende ao que a conexão precisa?
 *
 * ## Por que isto existe
 *
 * A tela de consentimento do Google mostra **uma caixa por permissão**, e ela
 * não vem marcada. Quem clica em "Continuar" sem marcar recebe um `code`
 * válido e um token válido — só que sem `calendar.events.owned` nem
 * `gmail.send`. Nada na resposta do Google diz "faltou".
 *
 * O callback gravava esse token como `status: 'connected'`, a tela mostrava a
 * faixa verde *"Google Calendar conectado com sucesso"* e o selo "✓
 * Conectado", e a falha só aparecia dias depois, ao tentar agendar, como um
 * genérico "Não foi possível criar o evento". Duas afirmações falsas na tela e
 * nenhum caminho de volta.
 *
 * ## Por que não basta comparar por igualdade
 *
 * A comparação exata é o que `testarEscopoConcedido` fazia, e ela reprova
 * quem está certo. Medido nas conexões de produção em 27/08/2026:
 *
 *     henriquestn24@gmail.com     calendar.events.owned   exato
 *     pedroescobar90sb@gmail.com  calendar.events         LARGO, de antes de 23/08
 *
 * A segunda é anterior à troca de escopo daquele dia e carrega
 * `calendar.events`, que **contém** `calendar.events.owned`: escrever em
 * `calendars/primary/events` funciona com ela. Recusar essa conexão mandaria
 * reconectar quem não tem problema nenhum, e o botão "Testar conexão" já
 * dizia "não funcionando" para ela.
 *
 * O caminho oposto não vale: quem concedeu só `calendar.events.owned` **não**
 * pode agir sobre calendário de terceiro. A relação tem direção, e por isso é
 * um mapa explícito e não uma comparação de prefixo — `calendar.events.owned`
 * e `calendar.events` compartilham prefixo nos dois sentidos.
 */

/**
 * Escopos que englobam o exigido. Ler como: "quem tem qualquer um destes,
 * também pode fazer o que o exigido permite".
 *
 * Só entram escopos que o Google documenta como mais amplos e que este produto
 * já concedeu em alguma época. Acrescentar aqui é ampliar o que se aceita,
 * então cada linha precisa de motivo.
 */
const ESCOPOS_QUE_ENGLOBAM: Record<string, readonly string[]> = {
  // `calendar.events` cobre eventos em qualquer calendário, inclusive os
  // próprios; `calendar` cobre a agenda inteira. Os dois foram pedidos por
  // este app antes da submissão de 23/08 ao Google.
  'https://www.googleapis.com/auth/calendar.events.owned': [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar',
  ],
  // `gmail.send` é o mais restrito que existe para envio; `gmail.modify` e
  // `https://mail.google.com/` o contêm. Este app nunca pediu nenhum dos dois,
  // e estão aqui para o caso de uma conta antiga tê-los concedido por outro
  // caminho — aceitar não amplia o que o produto PEDE.
  'https://www.googleapis.com/auth/gmail.send': [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://mail.google.com/',
  ],
}

export function escopoAtendido(concedidos: readonly string[], exigido: string): boolean {
  if (concedidos.includes(exigido)) return true
  return (ESCOPOS_QUE_ENGLOBAM[exigido] ?? []).some((amplo) => concedidos.includes(amplo))
}

/**
 * Divide a string `scope` que o Google devolve.
 *
 * Separador é espaço, mas o campo já chegou com quebra de linha em resposta de
 * erro, e `split(' ')` deixaria `"\ngmail.send"` como item — que nunca casa
 * com nada e faz uma conexão boa parecer sem permissão. `\s+` com filtro de
 * vazios evita as duas coisas.
 */
export function listaDeEscopos(scope: string | null | undefined): string[] {
  return (scope ?? '').split(/\s+/).filter(Boolean)
}

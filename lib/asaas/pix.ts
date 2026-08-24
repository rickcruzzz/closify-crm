/**
 * O Pix mostrado DENTRO do produto, em vez de na página do Asaas.
 *
 * ## Por que trazer para cá
 *
 * O fluxo antigo abria `invoiceUrl` numa aba nova. Dois problemas, e o segundo
 * é o que dói:
 *
 * 1. **A pessoa sai do produto** no momento de maior intenção de compra. Todo
 *    salto entre domínios perde gente, e este acontece exatamente depois de ela
 *    já ter decidido pagar.
 *
 * 2. **A página do Asaas mostra o nome do titular em destaque.** Para MEI, esse
 *    nome é o nome civil da pessoa — o nome fantasia foi descontinuado da base
 *    do CNPJ em 15/11/2023 e não há campo alternativo (dado da Receita, não
 *    limitação do Asaas; ver `docs/estado-atual.md`). Quem clicou em "Assinar o
 *    Velo Funil" cai numa tela com o nome de um desconhecido no topo, e é dessa
 *    não-identificação que nasce a desistência — e, depois, a contestação.
 *
 * Com o QR aqui dentro, a marca da tela é nossa. O nome do titular continua
 * aparecendo no app do banco, na confirmação — isso não muda —, mas ali é uma
 * linha de confirmação, não uma página inteira.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não processa cartão. O Asaas permite (`/creditCard/tokenizeCreditCard`), mas
 * isso faz o número do cartão passar pelo nosso servidor e nos coloca no escopo
 * de PCI-DSS — auditoria, questionário de conformidade e responsabilidade legal
 * em caso de vazamento. Para um SaaS de R$ 49 com um operador, não compensa:
 * cartão e boleto continuam no caminho hospedado do Asaas, onde a
 * responsabilidade é deles.
 */

/** Resposta de `GET /payments/{id}/pixQrCode`, medida contra a API em 23/08. */
export type QrCodePixDoAsaas = {
  success?: boolean
  /** PNG do QR Code em Base64, SEM o prefixo `data:image/png;base64,`. */
  encodedImage?: string
  /** O código copia-e-cola (payload EMV do Pix). */
  payload?: string
  /** `YYYY-MM-DD HH:mm:ss`, no fuso do Asaas. */
  expirationDate?: string
}

export type PixParaExibir = {
  /** Pronto para o `src` de uma `<img>`. */
  imagemDataUrl: string
  copiaECola: string
  expiraEm: string | null
}

/**
 * Converte a resposta do Asaas no que a tela precisa.
 *
 * Devolve `null` em vez de lançar quando falta imagem ou payload: um QR que não
 * veio é um problema de exibição, não motivo para derrubar a página inteira de
 * quem está tentando pagar. Quem chama decide o que mostrar no lugar — e o
 * caminho do Asaas continua disponível como alternativa.
 */
export function prepararPixParaExibir(resposta: QrCodePixDoAsaas | null): PixParaExibir | null {
  if (!resposta?.encodedImage || !resposta.payload) return null

  return {
    // O Asaas devolve o Base64 cru. O prefixo é nosso — sem ele, a `<img>` não
    // renderiza nada e o erro é silencioso: a tela some sem log nenhum.
    imagemDataUrl: `data:image/png;base64,${resposta.encodedImage}`,
    copiaECola: resposta.payload,
    expiraEm: resposta.expirationDate ?? null,
  }
}

/**
 * Texto curto sobre a validade do código.
 *
 * O Asaas devolve validade longa (medido: mais de um ano para cobrança com
 * vencimento futuro). Mostrar "expira em 391 dias" não tranquiliza ninguém e
 * ainda ocupa espaço — só vale avisar quando o prazo é curto o bastante para
 * mudar o comportamento de quem está com o celular na mão.
 */
export function avisoDeValidade(expiraEm: string | null, agora: Date = new Date()): string | null {
  if (!expiraEm) return null

  // Duas armadilhas neste parse, e as duas já custaram caro neste projeto.
  //
  // 1. `YYYY-MM-DD HH:mm:ss` NÃO é ISO 8601. Sem o `T`, o Safari devolve
  //    `Invalid Date` e a tela quebra só nele — defeito que não aparece em
  //    desenvolvimento e surge na mão do cliente.
  //
  // 2. **O fuso precisa ser explícito.** O Asaas responde no horário de
  //    Brasília, sem indicar isso na string. `new Date('2026-08-23T20:00:00')`
  //    é interpretado como hora LOCAL de quem executa — e o servidor da Vercel
  //    roda em UTC. O aviso erraria em 3 horas em produção e acertaria na
  //    máquina do desenvolvedor, que é o pior tipo de bug: o que só existe
  //    onde ninguém está olhando. Mesma família do `diaEmSaoPaulo`, registrada
  //    em `docs/estado-atual.md`.
  //
  // `-03:00` é constante: o Brasil não tem horário de verão desde 2019.
  const fim = new Date(`${expiraEm.replace(' ', 'T')}-03:00`)
  if (Number.isNaN(fim.getTime())) return null

  const horas = (fim.getTime() - agora.getTime()) / 3_600_000

  if (horas <= 0) return 'Este código expirou. Gere um novo para pagar.'
  if (horas <= 1) return 'Este código expira em menos de 1 hora.'
  if (horas <= 24) return `Este código expira em ${Math.floor(horas)} horas.`

  return null
}

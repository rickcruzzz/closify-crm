import { apenasDigitos } from '@/lib/leads/planilha'

/**
 * Monta o link de conversa do WhatsApp a partir do telefone do lead.
 *
 * Por que link e não a Cloud API: a API oficial exige conta Meta Business
 * verificada, que exige CNPJ ativo, mais aprovação de template e custo por
 * mensagem. O link resolve o que a pessoa quer, abrir a conversa, sem
 * nenhuma dessas dependências.
 *
 * Devolve `null` quando o número não tem cara de telefone brasileiro. É
 * deliberado: `wa.me` com número inválido abre uma tela de erro do WhatsApp,
 * e quem clicou vai achar que o defeito é do Velo Funil. Melhor não oferecer
 * o botão do que oferecer um que quebra.
 */
export function linkDoWhatsApp(telefone: string | null | undefined): string | null {
  const numero = normalizarTelefoneBrasileiro(telefone)
  return numero ? `https://wa.me/${numero}` : null
}

/**
 * O número em formato internacional só com dígitos (`5511988887777`), ou
 * `null` quando não tem cara de telefone brasileiro válido.
 *
 * Extraída de `linkDoWhatsApp` para ser reusada pelo pareamento por código do
 * WhatsApp, que precisa do mesmo número mas não de um link. A validação já
 * separa celular de fixo e recusa número estrangeiro do mesmo tamanho, com
 * teste travando cada caso — duplicar essa lógica criaria uma segunda verdade
 * que divergiria da primeira na primeira mudança.
 */
export function normalizarTelefoneBrasileiro(
  telefone: string | null | undefined,
): string | null {
  if (!telefone) return null

  let numero = apenasDigitos(telefone)
  if (!numero) return null

  // O 0 de operadora ("0 21 11 98888-7777") sobra na hora de discar por app.
  while (numero.startsWith('0')) {
    numero = numero.slice(1)
  }

  // Já veio com DDI do Brasil: 55 + DDD (2) + número (8 ou 9).
  if (numero.startsWith('55') && (numero.length === 12 || numero.length === 13)) {
    return montar(numero)
  }

  // Sem DDI: DDD (2) + número (8 fixo ou 9 celular).
  if (numero.length === 10 || numero.length === 11) {
    return montar(`55${numero}`)
  }

  // Qualquer outro tamanho é ramal, número truncado, ou telefone de fora do
  // Brasil, que este produto não atende. Sem palpite.
  return null
}

function montar(numeroComDdi: string): string | null {
  const ddd = Number(numeroComDdi.slice(2, 4))

  // DDD brasileiro vai de 11 a 99. Um "00" ou "10" aqui é sinal de que o
  // número veio torto da planilha, não de um telefone real.
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) return null

  // O primeiro dígito depois do DDD é o que separa telefone brasileiro de
  // número estrangeiro do mesmo tamanho. Sem esta checagem, "+1 415 555 2671"
  // (EUA, 11 dígitos sem o DDI) ganhava um "55" na frente e virava um número
  // brasileiro que não existe, o teste pegou exatamente isso.
  const primeiro = numeroComDdi[4]

  // 13 dígitos = celular: todo celular do país recebeu o nono dígito, que é
  // sempre 9.
  if (numeroComDdi.length === 13) {
    return primeiro === '9' ? numeroComDdi : null
  }

  // 12 dígitos = fixo: começa em 2, 3, 4 ou 5.
  if (primeiro && primeiro >= '2' && primeiro <= '5') {
    return numeroComDdi
  }

  // 12 dígitos começando em 9 é celular SEM o nono dígito — a forma que o
  // próprio WhatsApp usa.
  //
  // Descoberto em 25/08, com a primeira mensagem real: o `Chat` chegou como
  // `557193309404@s.whatsapp.net`, e o número gravado no contato era esse.
  // Toda função de telefone do produto o recusava, porque 8 dígitos começando
  // em 9 não é fixo (fixo começa em 2-5) nem celular (celular tem 9 dígitos).
  //
  // O efeito era pior do que um número inválido: o contato entrava no funil, o
  // botão "Chamar no WhatsApp" sumia da tela dele, e a tarefa "Responder no
  // WhatsApp" não tinha como abrir a conversa. O cliente ficava registrado e
  // inalcançável.
  //
  // Devolver com o 9 reposto é o que faz o número voltar a ser o mesmo em todo
  // lugar: `wa.me` aceita as duas formas, mas o resto do produto — busca,
  // comparação, deduplicação de contato — precisa de UMA.
  if (numeroComDdi.length === 12 && primeiro === '9') {
    return `${numeroComDdi.slice(0, 4)}9${numeroComDdi.slice(4)}`
  }

  return null
}

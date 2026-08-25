/**
 * O mesmo número de WhatsApp não pode servir a duas empresas.
 *
 * ## O que isso quebra quando acontece
 *
 * O WhatsApp permite quatro aparelhos vinculados por conta, e cada instância do
 * Evolution ocupa um deles. Nada impede parear o MESMO número em duas
 * instâncias — e foi o que aconteceu em 25/08: `557185040900:92` numa empresa
 * e `:93` em outra.
 *
 * O estrago não é teórico:
 *
 * **A mensagem vira loteria.** Duas instâncias disputam os mesmos eventos da
 * conta. O cliente escreve uma vez, e o funil que recebe é o que ganhou a
 * corrida — ou nenhum, se uma das duas estiver num estado meio-morto
 * (`Connected` sem `LoggedIn`, medido no mesmo dia).
 *
 * **O histórico se parte em dois.** Metade das conversas de um cliente numa
 * empresa, metade na outra. Num produto que promete que a empresa é dona do
 * histórico, isso é a falha central.
 *
 * **E vaza entre empresas.** Se duas empresas diferentes parearem o mesmo
 * número, uma passa a receber mensagem destinada à outra. O isolamento por
 * RLS não protege disso: os dados entram legitimamente no workspace errado,
 * porque foi o webhook daquela instância que os trouxe.
 *
 * ## Por que a checagem é DEPOIS do pareamento, e não antes
 *
 * Não há como saber qual número vai ser escaneado antes de alguém escanear.
 * O `jid` só existe depois. Então a defesa é: assim que o número aparece,
 * comparar com o que as outras instâncias já usam e recusar a nova.
 *
 * A NOVA é a recusada, sempre. Quem chegou primeiro continua funcionando —
 * derrubar a conexão antiga faria um pareamento acidental cortar o WhatsApp de
 * uma empresa que estava trabalhando.
 */

/** O suficiente para decidir. Vem de `/instance/all`. */
export type InstanciaConhecida = {
  id: string
  /** `557185040900:93@s.whatsapp.net`, ou vazio quando não pareou. */
  jid: string | null | undefined
}

/**
 * O número dentro de um `jid`, sem o sufixo de aparelho nem o domínio.
 *
 * `557185040900:92@s.whatsapp.net` e `557185040900:93@s.whatsapp.net` são o
 * MESMO número em aparelhos diferentes — comparar o jid cru diria que são
 * distintos, que é exatamente o erro que deixou os dois pareamentos passarem.
 */
export function numeroDoJid(jid: string | null | undefined): string | null {
  if (!jid) return null

  const semDominio = jid.split('@')[0] ?? ''
  const numero = semDominio.split(':')[0] ?? ''
  const digitos = numero.replace(/\D/g, '')

  return digitos.length > 0 ? digitos : null
}

/**
 * A instância de OUTRA empresa que já usa este número, se houver.
 *
 * Devolve `null` quando está livre — inclusive quando o `jid` ainda não
 * existe, porque instância sem número pareado não conflita com ninguém.
 */
export function conflitoDeNumero(params: {
  /** A instância que acabou de parear. */
  instanciaId: string
  jid: string | null | undefined
  /** Todas as instâncias do servidor, incluindo a própria. */
  conhecidas: InstanciaConhecida[]
}): InstanciaConhecida | null {
  const numero = numeroDoJid(params.jid)
  if (!numero) return null

  for (const outra of params.conhecidas) {
    if (outra.id === params.instanciaId) continue
    if (numeroDoJid(outra.jid) === numero) return outra
  }

  return null
}

/**
 * O que a pessoa lê quando o número já está em uso.
 *
 * Diz o que fazer, não só o que deu errado: sem o passo de desconectar do
 * outro lado, a única saída visível seria tentar de novo — que falharia
 * exatamente igual.
 */
export const AVISO_DE_NUMERO_EM_USO =
  'Este número de WhatsApp já está conectado em outra empresa. ' +
  'Cada número atende uma empresa só, senão as mensagens do mesmo cliente ' +
  'se dividem entre os dois funis. Desconecte lá primeiro, ou use outro número aqui.'

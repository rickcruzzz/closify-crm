/**
 * A higiene da lista e a rampa de envio do e-mail frio.
 *
 * ## Por que este arquivo existe separado do disparador
 *
 * Mesma razão de `lib/dono/trial.ts` e de `google-ads-queries.ts`: o script que
 * envia precisa de `RESEND_API_KEY` e de rede, e nada disso pode ser condição
 * para testar quem entra na lista e quantos saem por dia — que é justamente a
 * parte onde o erro custa o domínio inteiro.
 *
 * ## O que foi medido antes de escrever isto (10/09)
 *
 * O WhatsApp saiu de operação: a conta do dono foi restrita depois do disparo
 * de madrugada. O e-mail frio passou a ser o canal, e a medição no Exa
 * desmentiu duas coisas que eu ia propor.
 *
 * **Subdomínio NÃO protege o domínio raiz.** Eu ia sugerir
 * `mail.velofunil.com.br` como meio-termo entre marca e segurança. É falso:
 *
 *     "Google Postmaster Tools tracks domain reputation at the ROOT domain
 *      level — not the subdomain level."
 *
 * Ou seja: reclamação de spam em `mail.velofunil.com.br` derruba a reputação de
 * `velofunil.com.br`, que é de onde sai recuperação de senha. O estrago não
 * aparece como bloqueio — aparece como cliente que esqueceu a senha e não
 * consegue mais entrar, semanas depois. Domínio separado é a única saída, e a
 * marca se preserva no nome do remetente, não no domínio.
 *
 * **E o teto por caixa é 20-30/dia, não 50-75.** O número do Origami (50-75)
 * é o total da operação, distribuído em várias caixas:
 *
 *     "For cold outreach, the safe volume is 20 to 30 emails per inbox per day,
 *      far below the official ceiling. You scale by adding more inboxes and
 *      domains, never by pushing more volume through one inbox."
 */

/** Endereço ligado a uma função, não a uma pessoa. */
const PAPEL =
  /^(contato|contact|info|hello|comercial|vendas|sales|atendimento|suporte|support|financeiro|sac|faleconosco|fale|adm|administrativo|admin|webmaster|diretoria|orcamento|orcamentos|marketing|equipe|team|office)@/i

/** Caixa que nunca é lida por gente, ou que sequer é um endereço. */
const NAO_ENVIAR =
  /(no-?reply|nao-?responda|donotreply|example\.|@sentry|sentry\.io|wixpress|\.(png|jpe?g|gif|svg|webp)$|@2x)/i

const FORMATO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export type Destinatario = {
  email: string
  empresa?: string | null
}

export type Classificacao = 'pessoal' | 'papel' | 'recusado'

/**
 * Onde este endereço entra na fila.
 *
 * `papel` NÃO é recusa, e a distinção é o achado que mais importa aqui.
 *
 * O benchmark que trata `contato@` como veneno foi escrito para B2B americano,
 * onde ele cai numa fila de suporte e o time reclama de spam sem nem ler. O ICP
 * daqui é marcenaria e dedetizadora de uma a três pessoas — e a pesquisa sobre
 * operação solo diz, com estas palavras: *"There is no customer service team.
 * There is only you."* Ali `contato@` **é** a caixa do dono.
 *
 * Então eles entram, e entram DEPOIS: os pessoais primeiro, enquanto o domínio
 * ainda está construindo reputação, e os de papel quando ele já aguenta uma
 * reclamação sem afundar. Recusar 198 de 358 por uma regra calibrada para outro
 * mercado seria jogar fora 55% da lista por analogia.
 */
export function classificar(email: string): Classificacao {
  const e = email.trim().toLowerCase()
  if (!FORMATO.test(e)) return 'recusado'
  if (NAO_ENVIAR.test(e)) return 'recusado'
  return PAPEL.test(e) ? 'papel' : 'pessoal'
}

/**
 * Tira repetido, lixo, e devolve na ordem em que deve ser abordado.
 *
 * A dedupe é por endereço e não por empresa: dois sites do mesmo dono
 * compartilham caixa, e mandar duas vezes para a mesma pessoa é a reclamação
 * mais fácil de provocar que existe. Medido na base em 10/09: 421 linhas para
 * **358 endereços distintos** — 63 repetidos, 15% da lista.
 */
export function prepararFila(entradas: Destinatario[]): {
  fila: Destinatario[]
  pessoais: number
  papel: number
  recusados: number
  repetidos: number
} {
  const vistos = new Set<string>()
  const pessoais: Destinatario[] = []
  const papel: Destinatario[] = []
  let recusados = 0
  let repetidos = 0

  for (const entrada of entradas) {
    const email = (entrada.email ?? '').trim().toLowerCase()
    if (!email) {
      recusados++
      continue
    }
    if (vistos.has(email)) {
      repetidos++
      continue
    }
    vistos.add(email)

    const tipo = classificar(email)
    if (tipo === 'recusado') recusados++
    else if (tipo === 'pessoal') pessoais.push({ ...entrada, email })
    else papel.push({ ...entrada, email })
  }

  return {
    fila: [...pessoais, ...papel],
    pessoais: pessoais.length,
    papel: papel.length,
    recusados,
    repetidos,
  }
}

/**
 * Quantos e-mails podem sair hoje, dado quantos dias a caixa já enviou.
 *
 * `dia` é 1 no primeiro dia de uso da caixa. A rampa chega ao teto seguro de 25
 * no dia 15 e para ali — **nunca sobe além**, porque escalar é abrir caixa
 * nova, não empurrar mais por uma só.
 *
 * Os degraus dobram devagar de propósito: provedor classifica por variação, não
 * por volume absoluto. Sair de 5 para 25 num dia é sinal mais forte de robô do
 * que mandar 25 todo dia desde sempre.
 */
export function tetoDoDia(dia: number): number {
  if (dia < 1) return 0
  if (dia <= 3) return 5
  if (dia <= 7) return 10
  if (dia <= 11) return 15
  if (dia <= 14) return 20
  return 25
}

/**
 * Em quantos dias a fila inteira sai, com uma caixa só.
 *
 * Existe para a conversa sobre abrir a segunda caixa acontecer com número, e
 * não com impressão. Com 358 endereços e uma caixa, são cerca de 17 dias — e
 * duas caixas cortam pela metade sem que nenhuma delas passe do teto.
 */
export function diasParaEsvaziar(total: number, caixas = 1): number {
  if (total <= 0 || caixas < 1) return 0
  let restam = total
  let dia = 0
  while (restam > 0 && dia < 400) {
    dia++
    restam -= tetoDoDia(dia) * caixas
  }
  return dia
}

import { nomeCurto } from '@/lib/inteligencia-de-mercado/dominio/abordagem'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'
import { CONTROLADOR, assinaturaPublica } from '@/lib/legal'

/**
 * O assunto e o corpo do e-mail frio.
 *
 * ## As regras vieram de medição, não de gosto (10/09)
 *
 *     assunto personalizado com a empresa    46% de abertura contra 35%
 *     assunto em forma de PERGUNTA           46%, o melhor de todos os tipos
 *     2 a 4 palavras                         46%, o topo por tamanho
 *     hype, urgencia ("ASAP"), "Ola amigo"   abaixo de 36%
 *     numero no assunto                      27% contra 28% — piora um pouco
 *
 * As quatro primeiras se combinam num formato só, e é o que este arquivo
 * produz: pergunta curta com o nome da empresa dentro.
 *
 * ## Texto puro, e isso é decisão
 *
 * Sem HTML, sem imagem, sem rastreador de abertura. Filtro moderno avalia o
 * perfil inteiro do remetente, e e-mail de uma pessoa para outra não tem
 * template. Um HTML de marketing num domínio novo é a combinação que o
 * classificador de spam foi treinado para achar.
 *
 * O custo é real e assumido: **sem pixel, não há taxa de abertura.** O número
 * que sobra é resposta, que é o único que decide alguma coisa de qualquer
 * forma — e foi a falta dele que deixou o WhatsApp cego.
 *
 * ## A LGPD é atendida no rodapé, e ela não é opcional
 *
 * Medido: e-mail frio B2B no Brasil é legal sob **interesse legítimo** (Art. 7º,
 * IX), e não sob consentimento — mas a base legal só se sustenta com três
 * coisas na própria mensagem: quem está falando, de onde veio o contato, e
 * como sair. `ana@empresa.com.br` é dado pessoal da Ana mesmo sendo endereço
 * corporativo, e é isso que muita gente erra.
 *
 * O rodapé cumpre os três, com o CNPJ real lido de `lib/legal.ts`.
 */

const ASSUNTOS = [
  (empresa: string) => `Orçamento da ${empresa}?`,
  (empresa: string) => `${empresa}: cliente sumiu?`,
  (empresa: string) => `Pergunta sobre a ${empresa}`,
  (empresa: string) => `Orçamento parado, ${empresa}?`,
] as const

/**
 * Escolhe uma variante de forma estável a partir do domínio.
 *
 * Mesma função de `abordagem.ts`, pelo mesmo motivo: o texto precisa ser
 * idêntico se a mesma empresa for processada duas vezes, senão um reenvio
 * acidental chega com outra redação e denuncia a máquina. FNV-1a porque é
 * determinístico entre execuções, o que `Math.random` não é.
 */
function semente(chave: string): number {
  let h = 2166136261
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function assuntoPara(dominio: string, nomeDaEmpresa: string | null | undefined): string {
  const empresa = nomeCurto(nomeDaEmpresa, dominio)
  const escolhido = ASSUNTOS[semente(`assunto:${dominio}`) % ASSUNTOS.length]
  return escolhido(empresa)
}

export type CorpoDoEmail = {
  dominio: string
  nomeDaEmpresa?: string | null
  /** Token que identifica este destinatário no link de descadastro. */
  tokenDeSaida: string
  /** Base do link de saída, sem barra no fim. */
  urlDoProduto: string
}

/**
 * O corpo, em texto puro.
 *
 * Curto de propósito: a versão do WhatsApp tem 527 caracteres e o e-mail não
 * pode ser maior só porque cabe. O que muda entre os dois é o rodapé, que aqui
 * é exigência legal e lá era a linha "não volto a procurar".
 */
export function corpoDoEmail(d: CorpoDoEmail): string {
  const empresa = nomeCurto(d.nomeDaEmpresa, d.dominio)
  const base = d.urlDoProduto.replace(/\/+$/, '')

  return [
    `Oi! Achei a ${empresa} procurando empresas do setor no Google.`,
    ``,
    `Quando você manda um orçamento e o cliente some, o retorno fica na memória de quem?`,
    ``,
    `Construí um sistema pra isso: o orçamento entra com a data do retorno e o lembrete nasce junto, no dia. R$ ${PRO_PLAN_PRICE} pela empresa toda, sem cobrar por usuário.`,
    ``,
    `Dá pra testar sem pagar e sem cartão, com até ${FREE_LEAD_LIMIT} contatos:`,
    `${base}/?utm_source=email`,
    ``,
    `Se não fizer sentido, é só ignorar, ou clicar abaixo que eu não escrevo de novo.`,
    ``,
    `--`,
    // `assinaturaPublica` e nao a razao social: a decisao de 24/08 tirou o
    // nome civil do titular de toda superficie de marca, e o proprio
    // `lib/legal.ts` documenta esta funcao como "rodape dos e-mails".
    // Ela ja entrega nome fantasia + CNPJ, que e o que o Art. 9o, I pede.
    // O separador NAO leva "CNPJ": `assinaturaPublica` ja escreve a palavra.
    // Passar ' — CNPJ ' produzia "Velo Funil — CNPJ CNPJ 68.877.105/0001-67",
    // que nenhum teste pegou — os casos conferiam se o NUMERO aparecia, e ele
    // aparecia. Achado abrindo o texto renderizado, que e a regra que o
    // `conferir-criativos.py` ja repete: colisao de texto, so o olho pega.
    assinaturaPublica(CONTROLADOR, ', '),
    `Achei seu contato no site da empresa. Não quer mais receber?`,
    `${base}/nao-quero?t=${encodeURIComponent(d.tokenDeSaida)}`,
  ].join('\n')
}

/**
 * O que o teste de sanidade confere antes de qualquer envio.
 *
 * Existe porque as três exigências da LGPD são invisíveis quando faltam: o
 * e-mail sai, chega, e só vira problema quando alguém reclama. Um `throw` aqui
 * é mais barato que uma denúncia à ANPD.
 */
export function conferirConformidade(corpo: string): void {
  if (!CONTROLADOR.cnpj || !corpo.includes(CONTROLADOR.cnpj)) {
    throw new Error('corpo sem CNPJ: interesse legítimo exige identificar quem fala')
  }
  if (!/nao-quero|não-quero/.test(corpo)) {
    throw new Error('corpo sem link de saída: opt-out é obrigatório')
  }
  if (!/Achei .* no site|Achei seu contato/.test(corpo)) {
    throw new Error('corpo não diz de onde veio o contato')
  }
}

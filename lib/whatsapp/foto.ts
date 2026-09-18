/**
 * Quando vale buscar a foto de perfil de um contato, e onde ela mora.
 *
 * Puro de propósito: a decisão é aritmética sobre uma data e um caminho, e é
 * justamente o tipo de regra que, escrita dentro do laço que faz I/O, nunca é
 * exercitada até o dia em que erra em produção.
 */

/** O bucket da 0096. Privado, e escrito só por `service_role`. */
export const BUCKET_DE_AVATARES = 'avatares'

/**
 * De quanto em quanto tempo a foto é reconferida.
 *
 * ## Por que reconferir, se a nossa cópia não expira
 *
 * A cópia no Storage é nossa e vive para sempre. O que envelhece é o outro
 * lado: a pessoa troca a foto de perfil, e o avatar do CRM continuaria
 * mostrando a de um ano atrás.
 *
 * ## Por que trinta dias, e não um
 *
 * Cada conferência é uma chamada ao provedor mais um download. Com trinta dias
 * um contato custa doze chamadas por ano; com um dia custa 365, para um dado
 * que quase nunca muda.
 *
 * E errar para o lado de reconferir pouco é barato: o pior caso é uma foto
 * desatualizada. Errar para o outro lado gasta cota do provedor e banda da VPS
 * em cima de um avatar de 32 pixels.
 */
export const DIAS_ATE_RECONFERIR = 30

/**
 * O teto de uma rodada.
 *
 * O cron roda de hora em hora. Vinte por passagem drenam 480 contatos por dia,
 * que é muito mais do que qualquer empresa cadastra, e mantêm a rodada curta o
 * bastante para caber no tempo de uma função da Vercel.
 */
export const POR_RODADA = 20

export type LeadParaFoto = {
  id: string
  workspaceId: string
  telefone: string | null
  fotoPath: string | null
  fotoVerificadaEm: string | null
}

export type DecisaoDeFoto =
  | { buscar: true }
  | { buscar: false; motivo: 'sem_telefone' | 'ja_conferida' }

/**
 * ## A primeira porta é a que evita gastar chamada com quem não tem número
 *
 * Contato sem telefone existe: a caixa recebe de LID e de grupo, e a
 * importação de planilha aceita quem só tem e-mail. Pedir a foto de um número
 * que não existe gasta a mesma chamada e devolve nada.
 *
 * ## E a segunda é a que impede o laço infinito
 *
 * `fotoVerificadaEm` guarda o FATO de termos perguntado, e não o resultado.
 * Sem ela, um contato que não tem foto de perfil — comum, porque o WhatsApp
 * deixa esconder a imagem de quem não é contato — seria perguntado a cada
 * passagem do cron, para sempre.
 *
 * É a mesma doutrina de `vigia_ultimo_aviso` (0062) e de `sem_max_desde`
 * (0091): guardar o que foi observado, em vez de tentar derivar depois.
 */
export function deveBuscarFoto(
  lead: Pick<LeadParaFoto, 'telefone' | 'fotoVerificadaEm'>,
  agora: Date = new Date(),
): DecisaoDeFoto {
  if (!lead.telefone) return { buscar: false, motivo: 'sem_telefone' }

  if (!lead.fotoVerificadaEm) return { buscar: true }

  const conferidaEm = new Date(lead.fotoVerificadaEm).getTime()

  // Data ilegível conta como AGORA, o que empurra a conferência para a próxima
  // janela em vez de liberar uma busca imediata. Errar segurando custa uma foto
  // velha; errar soltando gasta chamada a cada rodada.
  if (!Number.isFinite(conferidaEm)) return { buscar: false, motivo: 'ja_conferida' }

  const vence = conferidaEm + DIAS_ATE_RECONFERIR * 24 * 60 * 60 * 1000
  return agora.getTime() >= vence ? { buscar: true } : { buscar: false, motivo: 'ja_conferida' }
}

/**
 * Onde a foto mora dentro do bucket.
 *
 * ## O primeiro segmento é a empresa, e isso é a segurança inteira
 *
 * A policy da 0096 resolve o dono do arquivo por
 * `workspace_do_caminho(name)`, que lê o PRIMEIRO segmento do caminho como
 * uuid. Um caminho que não comece pelo id da empresa não pertence a ninguém e
 * não passa por policy nenhuma — o que é o lado seguro de errar.
 *
 * ## Um arquivo por contato, sobrescrito, e não um por versão
 *
 * O nome é o id do lead, sem sufixo de data nem hash. Trocar a foto
 * sobrescreve. Guardar versões encheria o bucket com imagens que nenhuma tela
 * alcança, e a única pergunta que este produto faz é "qual é a foto de agora".
 */
export function caminhoDaFoto(workspaceId: string, leadId: string): string {
  return `${workspaceId}/${leadId}.jpg`
}

/**
 * O tipo de imagem é aceitável para o bucket?
 *
 * Conferido nos BYTES pelo chamador, e não no `Content-Type` que o provedor
 * declara. É a mesma lição que `lib/storage/logo.ts` já carrega: o cabeçalho é
 * a segunda linha de defesa, porque quem o escreve pode mentir.
 */
export function tipoAceito(tipo: string | null): boolean {
  if (!tipo) return false
  return ['image/jpeg', 'image/png', 'image/webp'].includes(tipo.split(';')[0]!.trim())
}

/**
 * O `link` que o provedor devolveu é uma URL de verdade?
 *
 * ## A Z-API devolve a STRING "null", e nao JSON null
 *
 * Medido em 18/09 contra a conta real, com um numero que tem foto e outro que
 * nao tem:
 *
 *     557193309404    200   link = "https://pps.whatsapp.net/..."
 *     5511900000000   200   link = "null"          <- string, nao nulo
 *
 * `r.link ?? null` deixa a segunda passar, porque `"null"` e truthy. O
 * `fetch("null")` entao lanca `ERR_INVALID_URL`, cai no `catch` do chamador, e
 * o `catch` NAO grava `foto_verificada_em` de proposito — porque falha de rede
 * pede nova tentativa.
 *
 * O resultado seria o pior possivel: **todo contato sem foto visivel voltando
 * a fila a cada passagem do cron, para sempre**, que e exatamente o laco
 * infinito que `foto_verificada_em` existe para fechar. Um erro por contato por
 * rodada, e nenhum deles indicando o que esta errado.
 *
 * Sexta vez que esta API responde 200 com algo que nao e o que ela declara,
 * depois do `qrcode/image`, do `sendButtons`, do `notifySentByMe`, do verbo do
 * `disconnect` e do caminho do `qr-code`.
 *
 * ## Por que exigir `http`, e nao so recusar "null"
 *
 * Recusar a string literal consertaria o caso de hoje e nada mais. A pergunta
 * certa nao e "veio a palavra null", e sim "isto e algo que da para baixar" —
 * e a resposta que serve para qualquer lixo futuro e exigir o esquema.
 */
export function linkDeFotoValido(link: unknown): link is string {
  if (typeof link !== 'string') return false
  const limpo = link.trim()
  return limpo.startsWith('https://') || limpo.startsWith('http://')
}

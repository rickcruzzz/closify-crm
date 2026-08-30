/**
 * Anexo do relato de suporte: o que entra, e como se decide.
 *
 * Irmão de `lib/storage/logo.ts`, e a doutrina é a mesma: **a decisão é pelos
 * BYTES INICIAIS**, nunca pela extensão nem pelo `Content-Type`. Os dois são
 * escolhidos por quem envia, e renomear `payload.exe` para `print.png`
 * declarando `image/png` é trivial. O `allowed_mime_types` do bucket compara
 * justamente com o que o cliente declarou — ele filtra engano, não intenção.
 *
 * Arquivo próprio e não uma extensão de `logo.ts` porque as duas regras são
 * diferentes de verdade: logo aceita 2 MB e três formatos de imagem, anexo
 * aceita 10 MB e inclui PDF. Fundir os dois num arquivo com parâmetros faria a
 * mudança de um mexer no outro — e um deles decide o que entra no bucket
 * público da marca.
 */

export const ANEXO_BUCKET = 'anexos-feedback'

/**
 * 10 MB, o mesmo teto declarado no bucket (0061).
 *
 * Contra os 2 MB da logo: print em tela retina passa de 2 MB com folga, e
 * recusar justamente o print de quem está tentando mostrar o defeito seria o
 * pior lugar possível para economizar espaço.
 */
export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024

/**
 * Três arquivos por relato.
 *
 * O caso real é "antes e depois", raramente mais. O teto existe para o envio
 * não virar um caminho de subir arquivo arbitrário em lote — cada anexo é uma
 * ida ao Storage, e três já cobrem o relato mais detalhado que alguém escreve.
 */
export const ANEXO_QUANTIDADE_MAXIMA = 3

export type FormatoDeAnexo = 'png' | 'jpeg' | 'webp' | 'pdf'

const EXTENSAO: Record<FormatoDeAnexo, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  pdf: 'pdf',
}

const TIPO_MIME: Record<FormatoDeAnexo, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/**
 * Identifica o formato pelas assinaturas de bytes.
 *
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   JPEG  FF D8 FF
 *   WEBP  "RIFF" .... "WEBP"   (o tamanho fica entre as duas marcas)
 *   PDF   25 50 44 46          ("%PDF")
 *
 * As três primeiras são as mesmas de `logo.ts`, repetidas aqui de propósito:
 * importá-las de lá acoplaria a regra do anexo à da logo, e uma mudança em
 * qualquer uma passaria a mexer nas duas.
 *
 * O PDF é o único novo, e é o mais frouxo dos quatro — `%PDF` são quatro bytes
 * ASCII comuns. É o que a especificação define como cabeçalho, e não há
 * verificação mais forte sem interpretar o arquivo inteiro. Vale registrar a
 * limitação: **um arquivo que COMECE com `%PDF` passa**, mesmo que o resto não
 * seja um PDF válido. O bucket é privado, o arquivo nunca é executado, e a
 * exibição é sempre por link assinado com validade curta — então o pior caso é
 * um download que não abre no leitor.
 */
export function detectarFormatoDeAnexo(bytes: Uint8Array): FormatoDeAnexo | null {
  if (bytes.length < 12) return null

  const comeca = (assinatura: number[], offset = 0) =>
    assinatura.every((b, i) => bytes[offset + i] === b)

  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (comeca([0xff, 0xd8, 0xff])) return 'jpeg'
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  if (comeca([0x25, 0x50, 0x44, 0x46])) return 'pdf'

  return null
}

export type AnexoRecusado = { erro: string }
export type AnexoAceito = { formato: FormatoDeAnexo; tipoMime: string; extensao: string }

/**
 * Decide se o arquivo entra. Lógica pura, sem rede e sem Supabase.
 *
 * A mensagem de recusa diz o que FAZER, não o que aconteceu: quem tenta subir
 * um `.docx` precisa saber quais formatos servem, não que "a assinatura do
 * arquivo não corresponde a nenhum formato conhecido".
 */
export function validarAnexo(bytes: Uint8Array): AnexoAceito | AnexoRecusado {
  if (bytes.length === 0) {
    return { erro: 'O arquivo está vazio. Escolha outro.' }
  }

  if (bytes.length > ANEXO_TAMANHO_MAXIMO) {
    const mb = (bytes.length / 1024 / 1024).toFixed(1)
    return { erro: `O arquivo tem ${mb} MB. O limite é 10 MB.` }
  }

  const formato = detectarFormatoDeAnexo(bytes)

  if (!formato) {
    return { erro: 'Formato não aceito. Envie uma imagem (PNG, JPG, WEBP) ou um PDF.' }
  }

  return { formato, tipoMime: TIPO_MIME[formato], extensao: EXTENSAO[formato] }
}

/**
 * O caminho no bucket: `{workspace_id}/{feedback_id}/{aleatório}.{ext}`.
 *
 * O PRIMEIRO segmento é o que as políticas da 0061 leem para decidir de quem é
 * o arquivo (via `workspace_do_caminho`, da 0031). Mudar este formato quebra a
 * RLS do Storage **em silêncio**: a função passaria a devolver `null`, e tudo
 * seria recusado sem nenhum erro explicando por quê.
 *
 * O segundo agrupa por relato, e é o que permite a purga achar os arquivos de
 * um relato que está saindo. O terceiro é aleatório porque dois anexos podem
 * ter o mesmo nome original ("Captura de tela.png" é o padrão do sistema).
 */
export function caminhoDoAnexo(
  workspaceId: string,
  feedbackId: string,
  extensao: string,
): string {
  return `${workspaceId}/${feedbackId}/${crypto.randomUUID()}.${extensao}`
}

/**
 * O tamanho em texto, para a tela.
 *
 * Sem casa decimal abaixo de 1 MB: "340 KB" se lê num relance, "339,8 KB" faz
 * o olho parar para processar um número que não muda decisão nenhuma.
 */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

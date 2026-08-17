export const LOGO_BUCKET = 'logos'

/** 2 MB, o mesmo teto declarado no bucket (0031). */
export const LOGO_TAMANHO_MAXIMO = 2 * 1024 * 1024

export type FormatoDeLogo = 'png' | 'jpeg' | 'webp'

const EXTENSAO: Record<FormatoDeLogo, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

const TIPO_MIME: Record<FormatoDeLogo, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Identifica o formato pelos BYTES INICIAIS, não pela extensão nem pelo
 * `Content-Type`.
 *
 * Os dois são escolhidos por quem envia. Renomear `payload.svg` para
 * `logo.png` e declarar `image/png` é trivial, e o `allowed_mime_types` do
 * bucket compara justamente com o que o cliente declarou, ele filtra engano,
 * não intenção.
 *
 * Assinaturas:
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   JPEG  FF D8 FF
 *   WEBP  "RIFF" .... "WEBP"  (o tamanho fica entre as duas marcas)
 */
export function detectarFormato(bytes: Uint8Array): FormatoDeLogo | null {
  if (bytes.length < 12) return null

  const comeca = (assinatura: number[], offset = 0) =>
    assinatura.every((b, i) => bytes[offset + i] === b)

  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (comeca([0xff, 0xd8, 0xff])) return 'jpeg'

  // RIFF....WEBP
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }

  return null
}

export type LogoRecusada = { erro: string }
export type LogoAceita = { formato: FormatoDeLogo; tipoMime: string; extensao: string }

/**
 * Decide se o arquivo pode ser aceito. Lógica pura, sem rede, sem Supabase.
 *
 * A mensagem de recusa diz o que fazer, não o que aconteceu: quem tenta subir
 * um SVG precisa saber quais formatos servem, e não que "a assinatura do
 * arquivo não corresponde".
 */
export function validarLogo(bytes: Uint8Array): LogoAceita | LogoRecusada {
  if (bytes.length === 0) {
    return { erro: 'O arquivo está vazio. Escolha outra imagem.' }
  }

  if (bytes.length > LOGO_TAMANHO_MAXIMO) {
    const mb = (bytes.length / 1024 / 1024).toFixed(1)
    return { erro: `A imagem tem ${mb} MB. O limite é 2 MB.` }
  }

  const formato = detectarFormato(bytes)

  if (!formato) {
    return { erro: 'Formato não aceito. Envie um arquivo PNG, JPG ou WEBP.' }
  }

  return { formato, tipoMime: TIPO_MIME[formato], extensao: EXTENSAO[formato] }
}

/**
 * O caminho dentro do bucket: `{workspace_id}/{aleatório}.{ext}`.
 *
 * O primeiro segmento é o que as políticas da 0031 leem para decidir de quem é
 * o arquivo, mudar este formato quebra a RLS do Storage em silêncio, porque
 * `workspace_do_caminho` passaria a devolver `null` e tudo seria recusado.
 *
 * Nome aleatório e não fixo: um nome previsível faria o navegador e o CDN
 * servirem a logo antiga do cache depois da troca.
 */
export function caminhoDaLogo(workspaceId: string, extensao: string): string {
  return `${workspaceId}/${crypto.randomUUID()}.${extensao}`
}

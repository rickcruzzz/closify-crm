import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { get } from 'node:https'
import { validarLogo } from '@/lib/storage/logo'

export function enderecoPublico(ip: string): boolean {
  const endereco = ip.toLowerCase().replace(/^::ffff:/, '')
  if (isIP(endereco) === 4) {
    const [a, b] = endereco.split('.').map(Number)
    return a !== 0 && a !== 10 && a !== 127 && a! < 224 &&
      !(a === 169 && b === 254) && !(a === 172 && b! >= 16 && b! <= 31) &&
      !(a === 192 && (b === 168 || b === 0)) && !(a === 100 && b! >= 64 && b! <= 127)
  }
  return isIP(endereco) === 6 && /^[23][0-9a-f]{0,3}:/.test(endereco)
}

/** Sem redirecionamentos ou rede local. A imagem também é validada pelos bytes. */
export async function baixarImagemPublica(link: string, opcoes: { reduzir?: boolean } = {}) {
  const url = new URL(link)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('URL de imagem inválida.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const enderecos = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!enderecos.length || enderecos.some((entry) => !enderecoPublico(entry.address))) throw new Error('Imagem em endereço não público.')
  const limite = opcoes.reduzir ? 2 * 1024 * 1024 : 512 * 1024
  const erroDeTamanho = opcoes.reduzir ? 'Imagem acima de 2 MB.' : 'Imagem acima de 512 KB.'
  const endereco = enderecos.find((entry) => isIP(entry.address) === 4) ?? enderecos[0]!
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const request = get(url, {
      signal: AbortSignal.timeout(2_500),
      // Conecta no IP validado, sem uma segunda resolução DNS (rebinding).
      // O hostname original permanece no Host e no SNI/certificado TLS.
      lookup: (_hostname, options, callback) => {
        const family = isIP(endereco.address)
        if (options.all) callback(null, [{ address: endereco.address, family }])
        else callback(null, endereco.address, family)
      },
    }, (response) => {
      const recusar = (mensagem: string) => { response.destroy(); reject(new Error(mensagem)) }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        recusar(`Imagem indisponível: ${response.statusCode}.`)
        return
      }
      if (Number(response.headers['content-length']) > limite) { recusar(erroDeTamanho); return }
      const partes: Buffer[] = []
      let tamanho = 0
      response.on('data', (parte: Buffer) => {
        tamanho += parte.length
        if (tamanho > limite) { recusar(erroDeTamanho); return }
        partes.push(parte)
      })
      response.on('error', reject)
      response.on('end', () => resolve(Buffer.concat(partes)))
    })
    request.on('error', reject)
  })
  const formato = validarLogo(bytes)
  if ('erro' in formato) throw new Error(formato.erro)
  if (opcoes.reduzir && bytes.length > 512 * 1024) {
    const { default: sharp } = await import('sharp')
    const reduzida = await sharp(bytes, { limitInputPixels: 16_000_000 })
      .rotate().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer()
    if (reduzida.length > 512 * 1024) throw new Error('Imagem reduzida acima de 512 KB.')
    return { bytes: reduzida, formato: 'webp' as const, tipoMime: 'image/webp', extensao: 'webp' }
  }
  return { bytes, ...formato }
}

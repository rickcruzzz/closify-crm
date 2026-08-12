// Sem `server-only` de propósito, mesmo critério de lib/emails/layout.ts:
// é lógica pura (cifra/decifra uma string, sem rede, sem `next/*`), e
// `server-only` quebraria a importação no Vitest. A garantia de nunca correr
// no browser não vem deste import — vem de quem chama: só Server Actions e
// route handlers de integração leem `INTEGRATIONS_ENCRYPTION_KEY`, e essa
// variável não tem prefixo `NEXT_PUBLIC_`, então nem chegaria cifrada no
// bundle do client por engano.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITMO = 'aes-256-gcm'
// 12 bytes é o tamanho de IV recomendado para GCM — o padrão da própria
// documentação do Node, e o que evita o modo "IV maior" que muda a
// derivação interna do GHASH.
const TAMANHO_IV = 12
const TAMANHO_TAG = 16

function chave(): Buffer {
  const hex = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!hex) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY não configurada.')
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY precisa ter 32 bytes (64 caracteres hex).')
  }
  return buf
}

/**
 * Cifra um token antes de gravar em `integration_connections`.
 *
 * O resultado vai para uma coluna `bytea`. PostgREST lê e aceita bytea em
 * JSON no formato hexadecimal do próprio Postgres (`\x...`) — é o que
 * `to_json(bytea)` já produz na leitura, então usar o mesmo formato na
 * escrita evita qualquer conversão a mais entre app e banco.
 *
 * Layout do payload: IV (12 bytes) + tag de autenticação (16 bytes) +
 * texto cifrado, concatenados — um valor só, sem precisar de coluna extra
 * para IV/tag.
 */
export function cifrar(textoPlano: string): string {
  const iv = randomBytes(TAMANHO_IV)
  const cipher = createCipheriv(ALGORITMO, chave(), iv)
  const textoCifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, textoCifrado])
  return `\\x${payload.toString('hex')}`
}

/**
 * Decifra um valor lido de `access_token_enc`/`refresh_token_enc`.
 *
 * Só roda em Server Action ou route handler com a service role — a coluna
 * nem chega ao client `authenticated` (revoke por coluna na migration 0034).
 * `setAuthTag` faz a verificação de integridade: um payload adulterado (ou
 * cifrado com outra chave) estoura aqui, não devolve lixo em silêncio.
 */
export function decifrar(valorBytea: string): string {
  const hex = valorBytea.startsWith('\\x') ? valorBytea.slice(2) : valorBytea
  const payload = Buffer.from(hex, 'hex')

  const iv = payload.subarray(0, TAMANHO_IV)
  const tag = payload.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG)
  const textoCifrado = payload.subarray(TAMANHO_IV + TAMANHO_TAG)

  const decipher = createDecipheriv(ALGORITMO, chave(), iv)
  decipher.setAuthTag(tag)
  const textoPlano = Buffer.concat([decipher.update(textoCifrado), decipher.final()])
  return textoPlano.toString('utf8')
}

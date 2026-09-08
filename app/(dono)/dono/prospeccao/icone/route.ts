import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/**
 * O favicon de cada empresa da prateleira, servido de casa.
 *
 * ## Por que proxy, e não `<img src="https://www.google.com/s2/...">` direto
 *
 * A CSP deste projeto declara `img-src 'self' data: blob: <supabase> ...`, e
 * ela é **header de produção**. Apontar a tag direto para o Google exigiria
 * abrir `img-src` para um host de terceiro no site inteiro — para uma tela que
 * devolve 404 em produção. Enfraquecer a defesa de todo mundo pelo conforto de
 * uma página que ninguém além do dono alcança é troca ruim.
 *
 * Servido daqui, cai em `'self'`, que já é permitido. **Zero mudança de CSP.**
 *
 * ## De onde vem a imagem, e o que isso custa
 *
 * Medido em 08/09 sobre 24 domínios reais da própria lista:
 *
 *     google/s2/favicons     21 de 24   (88%), todos DISTINTOS entre si
 *     o proprio site         10 de 24   (42%)
 *     duckduckgo/ip3          8 de 24   (33%)
 *
 * O Google ganha porque lê o `<link rel="icon">` do HTML; os outros dois
 * tentam um caminho fixo. E os 21 serem distintos importa: se o serviço
 * estivesse devolvendo o globo padrão, a contagem pareceria alta e a tela
 * mostraria vinte ícones iguais — número plausível com conclusão errada, a
 * classe de erro mais cara deste projeto. As imagens foram comparadas por
 * hash, e não há duas iguais.
 *
 * **O custo é honesto e fica dito:** quem busca o ícone é o servidor local, e o
 * Google aprende quais domínios estão na lista de prospecção. Para os poucos em
 * que ele falha, a segunda tentativa é o `/favicon.ico` do próprio site — que
 * não conta nada a ninguém.
 *
 * ## O cache é o que torna isto barato
 *
 * Uma busca por domínio, para sempre. Sem ele, cada rolagem da lista dispararia
 * dezenas de requisições ao Google e a tela ficaria dependente da rede para
 * desenhar. A pasta está no `.gitignore`.
 */

export const dynamic = 'force-dynamic'

const PASTA = join(process.cwd(), '.dono-favicons')

/**
 * Domínio, e nada além disso.
 *
 * O valor vem da query string, e o servidor faz uma requisição com ele — é
 * exatamente a forma de um SSRF. Aceitar só letras, dígitos, ponto e hífen, com
 * ponto obrigatório e sem `..`, fecha a porta antes de qualquer `fetch`.
 */
const DOMINIO = /^[a-z0-9][a-z0-9.-]{2,252}\.[a-z]{2,}$/

function nomeNoDisco(dominio: string): string {
  return join(PASTA, dominio.replace(/[^a-z0-9.-]/g, '_') + '.img')
}

async function buscar(dominio: string): Promise<Buffer | null> {
  const tentar = async (url: string) => {
    const corte = new AbortController()
    const relogio = setTimeout(() => corte.abort(), 6000)
    try {
      const r = await fetch(url, { signal: corte.signal, redirect: 'follow' })
      if (!r.ok) return null
      const bytes = Buffer.from(await r.arrayBuffer())
      // Menos de 100 bytes não é ícone: é página de erro ou resposta vazia
      // servida com 200, que acontece bastante em hospedagem compartilhada.
      return bytes.byteLength > 100 ? bytes : null
    } catch {
      return null
    } finally {
      clearTimeout(relogio)
    }
  }

  return (
    (await tentar(`https://www.google.com/s2/favicons?domain=${dominio}&sz=64`)) ??
    (await tentar(`https://${dominio}/favicon.ico`))
  )
}

export async function GET(requisicao: Request) {
  await exigirAmbienteLocal()

  const dominio = (new URL(requisicao.url).searchParams.get('d') ?? '').toLowerCase().trim()
  if (!DOMINIO.test(dominio) || dominio.includes('..')) {
    return new Response(null, { status: 400 })
  }

  const caminho = nomeNoDisco(dominio)

  try {
    const guardado = await readFile(caminho)
    // Arquivo vazio é a marca de "já procurei e não tem". Sem ela, todo
    // domínio sem ícone seria buscado de novo a cada abertura da tela.
    if (guardado.byteLength === 0) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(guardado), {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' },
    })
  } catch {
    // Ainda não buscamos este domínio.
  }

  const bytes = await buscar(dominio)
  await mkdir(PASTA, { recursive: true })
  await writeFile(caminho, bytes ?? Buffer.alloc(0))

  if (!bytes) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' },
  })
}

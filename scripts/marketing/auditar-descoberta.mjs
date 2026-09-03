/**
 * O vigia da descoberta: tudo que pode impedir o produto de ser achado.
 *
 *     node scripts/marketing/auditar-descoberta.mjs
 *     node scripts/marketing/auditar-descoberta.mjs https://staging.exemplo.com
 *
 * ## Por que isto existe
 *
 * Em 03/09 o `robots.txt` SERVIDO tinha 76 linhas e o `app/robots.ts` gerava
 * 15. A diferença eram nove bots de IA bloqueados pelo Cloudflare, entre eles
 * o `Google-Extended` — ou seja, o Google estava proibido de citar o site nas
 * AI Overviews, e ninguém sabia.
 *
 * Nenhum dos quatro portões pega isso. `tsc`, `lint`, `test` e `build` leem o
 * código que GERA o robots; nunca o que é servido. É a mesma classe do CNPJ
 * baixado na landing, do pixel com quebra de linha colado na Vercel e da CSP
 * bloqueando a logo do Storage: configuração fora do repositório que muda o
 * comportamento do produto.
 *
 * Este script lê o site COMO O BUSCADOR LÊ — por HTTP, em produção.
 *
 * ## O que ele NÃO faz, e é a parte honesta
 *
 * Não faz o site aparecer. Ele verifica que nada está IMPEDINDO — que é outra
 * coisa. Aparecer depende de conteúdo que responda pergunta real e de links de
 * terceiros, e nenhum script escreve isso.
 */
import { argv } from 'node:process'

const BASE = (argv[2] ?? 'https://www.velofunil.com.br').replace(/\/$/, '')

/**
 * Os bots que decidem se uma IA pode CITAR o produto.
 *
 * `Google-Extended` é o que mais importa e o menos óbvio: ele não afeta o
 * ranking na busca (isso é o `Googlebot`), só autoriza uso em AI Overview e
 * Gemini. Bloqueá-lo torna o site invisível para quem pergunta em vez de
 * buscar — que é como cada vez mais gente descobre produto.
 */
const BOTS_DE_IA = [
  ['Google-Extended', 'AI Overviews e Gemini'],
  ['GPTBot', 'ChatGPT'],
  ['OAI-SearchBot', 'busca do ChatGPT'],
  ['ClaudeBot', 'Claude'],
  ['PerplexityBot', 'Perplexity'],
  ['meta-externalagent', 'Meta AI'],
]

let problemas = 0
let avisos = 0

const falha = (t) => {
  problemas += 1
  console.log(`  X  ${t}`)
}
const aviso = (t) => {
  avisos += 1
  console.log(`  !  ${t}`)
}
const ok = (t) => console.log(`  ok ${t}`)

async function pegar(caminho) {
  // Cache-buster: o Cloudflare serve robots e páginas de borda, e conferir uma
  // cópia velha é pior que não conferir — dá verde num problema que existe.
  const url = `${BASE}${caminho}${caminho.includes('?') ? '&' : '?'}_=${Date.now()}`
  const r = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'auditoria-velofunil' },
    redirect: 'follow',
  })
  return { status: r.status, texto: await r.text(), url: r.url }
}

console.log(`\nAUDITORIA DE DESCOBERTA — ${BASE}\n${'='.repeat(60)}`)

// ---------------------------------------------------------------- robots.txt
console.log('\nrobots.txt')
let urlsDoSitemap = []
try {
  const { status, texto } = await pegar('/robots.txt')
  if (status !== 200) {
    falha(`responde ${status}`)
  } else {
    const linhas = texto.split('\n')

    // Bloqueio de bot de IA: procura o `User-agent: X` seguido de Disallow: /
    for (const [bot, oQue] of BOTS_DE_IA) {
      const i = linhas.findIndex((l) => new RegExp(`^user-agent:\\s*${bot}\\s*$`, 'i').test(l.trim()))
      if (i === -1) {
        ok(`${bot} livre (${oQue})`)
        continue
      }
      const bloqueado = linhas
        .slice(i + 1, i + 6)
        .some((l) => /^disallow:\s*\/\s*$/i.test(l.trim()))
      if (bloqueado) falha(`${bot} BLOQUEADO — nada de ${oQue}`)
      else ok(`${bot} livre (${oQue})`)
    }

    if (!/^allow:\s*\/\s*$/im.test(texto)) aviso('sem `Allow: /` explícito')
    if (!/^sitemap:/im.test(texto)) falha('sitemap NÃO declarado no robots')
    else ok('sitemap declarado')
  }
} catch (e) {
  falha(`não consegui ler: ${String(e).slice(0, 60)}`)
}

// ---------------------------------------------------------------- sitemap
console.log('\nsitemap.xml')
try {
  const { status, texto } = await pegar('/sitemap.xml')
  if (status !== 200) {
    falha(`responde ${status}`)
  } else {
    urlsDoSitemap = [...texto.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim())
    if (urlsDoSitemap.length === 0) falha('nenhuma URL dentro')
    else ok(`${urlsDoSitemap.length} URLs`)

    // Poucas páginas é o gargalo real deste site, e o script diz isso na cara
    // em vez de dar verde e deixar a impressão de que está tudo resolvido.
    if (urlsDoSitemap.length < 10) {
      aviso(
        `só ${urlsDoSitemap.length} páginas — pouca superfície para ranquear ` +
          'em termo genérico. Concorrente tem centenas',
      )
    }
  }
} catch (e) {
  falha(`não consegui ler: ${String(e).slice(0, 60)}`)
}

// ---------------------------------------------------------------- cada página
console.log('\npáginas do sitemap')
const titulos = new Map()

for (const url of urlsDoSitemap) {
  const caminho = url.replace(BASE, '') || '/'
  const rotulo = caminho === '' ? '/' : caminho
  try {
    const { status, texto } = await pegar(rotulo)
    if (status !== 200) {
      falha(`${rotulo} responde ${status}`)
      continue
    }

    const achar = (re) => (texto.match(re)?.[1] ?? '').trim()
    const title = achar(/<title[^>]*>(.*?)<\/title>/is)
    const desc = achar(/<meta\s+name="description"\s+content="(.*?)"/is)
    const robots = achar(/<meta\s+name="robots"\s+content="(.*?)"/is)
    const canonical = achar(/rel="canonical"\s+href="(.*?)"/is)
    const ld = (texto.match(/application\/ld\+json/g) ?? []).length
    const og = /property="og:title"/i.test(texto)

    const erros = []
    if (!title) erros.push('sem <title>')
    else if (title.length > 60) erros.push(`title com ${title.length} chars (corta em ~60)`)
    if (!desc) erros.push('sem description')
    else if (desc.length > 160) erros.push(`description com ${desc.length} chars (corta em ~160)`)
    if (/noindex/i.test(robots)) erros.push('NOINDEX — invisível de propósito')
    if (!canonical) erros.push('sem canonical')
    if (!og) erros.push('sem Open Graph (link feio no WhatsApp)')

    // Título repetido faz o Google escolher uma página e ignorar a outra.
    if (title) {
      if (titulos.has(title)) erros.push(`title IGUAL ao de ${titulos.get(title)}`)
      else titulos.set(title, rotulo)
    }

    if (erros.length) erros.forEach((e) => falha(`${rotulo}: ${e}`))
    else ok(`${rotulo}  title ${title.length}ch · desc ${desc.length}ch · ${ld} JSON-LD`)

    if (!erros.length && ld === 0) {
      aviso(`${rotulo}: sem dados estruturados — resultado sai como link simples`)
    }
  } catch (e) {
    falha(`${rotulo}: ${String(e).slice(0, 50)}`)
  }
}

// ---------------------------------------------------------------- resumo
console.log(`\n${'='.repeat(60)}`)
console.log(`${problemas} problema(s), ${avisos} aviso(s)`)

if (problemas === 0) {
  console.log('\nNada IMPEDE o site de ser encontrado.')
  console.log('Isso nao e o mesmo que ser encontrado — para isso falta:')
  console.log('  1. conteudo que responda pergunta real de quem procura CRM')
  console.log('  2. links de terceiros apontando para ca')
  console.log('  3. tempo: dominio novo demora a ganhar confianca')
}

process.exit(problemas > 0 ? 1 : 0)

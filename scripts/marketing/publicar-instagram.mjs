/**
 * Publica um carrossel de feed em @velofunil, direto na Graph API da Meta.
 *
 *     node --env-file=.env.local scripts/marketing/publicar-instagram.mjs \
 *       marketing/instagram/feed/carrossel-1-pedagio --confirmar
 *
 * Sem `--confirmar` ele faz TUDO menos publicar: confere o token, resolve a
 * conta, sobe as imagens e imprime o que iria ao ar. É o modo padrão de
 * propósito — publicar para dez mil pessoas não pode ser o efeito colateral de
 * um comando digitado errado.
 *
 * ## Por que direto na Meta, e não pelo Windsor.ai
 *
 * O Windsor funcionava e foi removido em 31/08 por uma razão que só apareceu
 * quando as duas coisas foram medidas lado a lado: a conta do MCP
 * (`pousadailhadomeio@…`) e a da chave de API (`henriquestn24@…`) eram
 * DIFERENTES. Uma dizia "Instagram não conectado" enquanto a outra devolvia a
 * conta com 10.355 seguidores, e as duas estavam certas.
 *
 * Um intermediário que pode estar autenticado em duas identidades ao mesmo
 * tempo transforma "está conectado?" numa pergunta sem resposta única. Aqui há
 * um token só, e ele responde por si.
 *
 * ## O fluxo de publicação, e por que são três etapas
 *
 *     1. resolver   Pagina -> instagram_business_account
 *     2. container  um POST /media por imagem, com is_carousel_item
 *     3. publicar   um container-pai com os filhos, depois /media_publish
 *
 * A Meta não aceita publicar em uma chamada. Cada imagem vira um container que
 * ela baixa e valida de forma assíncrona, e só então o conjunto é publicado.
 * É por isso que a imagem precisa de **URL pública**: o servidor da Meta é quem
 * busca o arquivo, e ele não tem como alcançar um caminho no seu disco.
 */

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const GRAPH = 'https://graph.facebook.com/v23.0'

const TOKEN = (process.env.META_INSTAGRAM_TOKEN ?? '').trim()
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

/**
 * Bucket público onde as artes ficam para a Meta baixar.
 *
 * Público porque a Graph API busca a imagem sem enviar credencial nenhuma —
 * URL assinada com prazo não serve, e o Storage não oferece meio-termo.
 *
 * O que entra aqui é peça de marketing, feita para ser vista por dez mil
 * pessoas em seguida. Nenhum dado de cliente passa por este caminho, e o
 * script recusa qualquer arquivo fora da pasta de criativos.
 */
const BUCKET = 'criativos-publicos'

function exigir(condicao, mensagem) {
  if (!condicao) {
    console.error(`\n  ${mensagem}\n`)
    process.exit(1)
  }
}

async function graph(rota, opcoes = {}) {
  const url = `${GRAPH}${rota}${rota.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(TOKEN)}`
  const resposta = await fetch(url, opcoes)
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = corpo?.error ?? {}
    throw new Error(`${rota.split('?')[0]} -> HTTP ${resposta.status}: ${erro.message ?? JSON.stringify(corpo)}`)
  }
  return corpo
}

/**
 * Acha o id da conta de Instagram a partir das Páginas do token.
 *
 * Não recebe o id por parâmetro de propósito: um id colado à mão publica em
 * silêncio na conta errada, e a única confirmação viria depois, no feed de
 * alguém. Resolvido pelo token, o script só alcança o que o token alcança.
 */
async function resolverConta() {
  const { data: paginas = [] } = await graph('/me/accounts?fields=id,name,instagram_business_account{id,username,followers_count}')

  const comInstagram = paginas.filter((p) => p.instagram_business_account)
  exigir(
    comInstagram.length > 0,
    paginas.length
      ? `Nenhuma das ${paginas.length} Páginas tem Instagram vinculado.\n` +
        `  Páginas vistas: ${paginas.map((p) => p.name).join(', ')}\n` +
        `  Vincule em: Página > Configurações > Contas vinculadas > Instagram`
      : 'O token não enxerga Página nenhuma. Confira o escopo `pages_show_list`.',
  )

  exigir(
    comInstagram.length === 1,
    `O token alcança ${comInstagram.length} contas de Instagram:\n` +
      comInstagram.map((p) => `    @${p.instagram_business_account.username} (via ${p.name})`).join('\n') +
      `\n  Ambíguo demais para publicar. Restrinja o token a uma Página.`,
  )

  const ig = comInstagram[0].instagram_business_account
  return { id: ig.id, username: ig.username, seguidores: ig.followers_count, pagina: comInstagram[0].name }
}

/** Sobe uma arte e devolve a URL pública que a Meta vai buscar. */
async function subir(caminho) {
  exigir(
    caminho.includes('marketing/instagram/') || caminho.includes('marketing\\instagram\\'),
    `Recusado: ${caminho} está fora de marketing/instagram/.\n` +
      `  Este bucket é PÚBLICO, e só peça de marketing entra nele.`,
  )

  const bytes = await readFile(caminho)
  const nome = basename(caminho)
  const destino = `${BUCKET}/${nome}`

  const resposta = await fetch(`${SUPABASE_URL}/storage/v1/object/${destino}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/png',
      // Republicar a mesma peça é rotina (corrigir um texto, regerar a arte).
      // Sem isto, a segunda tentativa falha com "already exists".
      'x-upsert': 'true',
    },
    body: bytes,
  })

  const texto = await resposta.text()
  exigir(resposta.ok, `Upload de ${nome} falhou: HTTP ${resposta.status} ${texto.slice(0, 200)}`)

  return `${SUPABASE_URL}/storage/v1/object/public/${destino}`
}

async function main() {
  const [prefixo, ...resto] = process.argv.slice(2)
  const confirmar = resto.includes('--confirmar')

  exigir(prefixo, 'Uso: node --env-file=.env.local scripts/marketing/publicar-instagram.mjs <prefixo-dos-cards> [--confirmar]')
  exigir(TOKEN, 'META_INSTAGRAM_TOKEN vazio no .env.local. Ver .env.example para os escopos e onde gerar.')
  exigir(SUPABASE_URL && SERVICE_KEY, 'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')

  // Os cards, na ordem numérica do nome. A ordem É a narrativa: o card 1 é o
  // gancho e o último é o CTA. Ordenar pelo que o disco devolve traria
  // "-10" antes de "-2" no dia em que houver dez.
  const { glob } = await import('node:fs/promises')
  const encontrados = []
  // `{,-*}` casa as duas formas: `prefixo.png` da peça avulsa e `prefixo-1.png`
  // do carrossel. Sem a primeira, uma peça avulsa nunca é encontrada e o erro
  // sai como "achei 0 cards", que aponta para o lugar errado.
  for await (const f of glob(`${prefixo}{,-*}.png`)) {
    if (!f.includes('@4k')) encontrados.push(f)
  }
  encontrados.sort((a, b) => {
    const n = (s) => Number(s.match(/-(\d+)\.png$/)?.[1] ?? 0)
    return n(a) - n(b)
  })

  // ## Uma peça publica sozinha; duas ou mais viram carrossel
  //
  // Até 31/08 este script exigia 2 cards, e as 11 peças avulsas do feed não
  // tinham como ir ao ar por aqui. O caminho de imagem única é outro na Graph
  // API: sem `is_carousel_item`, sem container pai, e a legenda vai no próprio
  // container da imagem.
  //
  // A contagem decide sozinha em vez de haver uma flag `--avulsa`: uma flag
  // num prefixo que casa 5 arquivos publicaria só o primeiro, em silêncio, e a
  // única confirmação viria no feed de alguém.
  exigir(encontrados.length >= 1, `Nenhuma arte casou com "${prefixo}{,-*}.png".`)
  exigir(encontrados.length <= 10, `${encontrados.length} cards: o Instagram aceita no máximo 10.`)
  const ehCarrossel = encontrados.length > 1

  console.log(
    ehCarrossel
      ? `\n  ${encontrados.length} cards, nesta ordem:`
      : '\n  1 peça avulsa:',
  )
  encontrados.forEach((f, i) => console.log(`    ${i + 1}. ${basename(f)}`))

  const conta = await resolverConta()
  console.log(`\n  conta: @${conta.username}  (${conta.seguidores.toLocaleString('pt-BR')} seguidores, via ${conta.pagina})`)

  console.log('\n  subindo as artes:')
  const urls = []
  for (const arquivo of encontrados) {
    const url = await subir(arquivo)
    urls.push(url)
    console.log(`    ${basename(arquivo)}  ->  publica`)
  }

  const legenda = process.env.LEGENDA ?? ''

  if (!confirmar) {
    console.log('\n  ENSAIO — nada foi publicado.')
    console.log('  As artes já estão no bucket público e as URLs foram geradas.')
    console.log('  Para publicar de verdade, repita o comando com --confirmar.\n')
    return
  }

  const cap = legenda ? `&caption=${encodeURIComponent(legenda)}` : ''
  let containerFinal

  if (ehCarrossel) {
    console.log('\n  criando os containers:')
    const filhos = []
    for (const [i, url] of urls.entries()) {
      const r = await graph(`/${conta.id}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true`, { method: 'POST' })
      filhos.push(r.id)
      console.log(`    card ${i + 1}  ->  ${r.id}`)
    }

    const pai = await graph(
      `/${conta.id}/media?media_type=CAROUSEL&children=${filhos.join(',')}${cap}`,
      { method: 'POST' },
    )
    containerFinal = pai.id
    console.log(`\n  container do carrossel: ${containerFinal}`)
  } else {
    // Imagem única: a legenda vai NESTE container, porque não há pai onde
    // pendurá-la. Mandar `caption` num container de carrossel-item é aceito
    // pela API e ignorado no post — some sem erro.
    const unico = await graph(
      `/${conta.id}/media?image_url=${encodeURIComponent(urls[0])}${cap}`,
      { method: 'POST' },
    )
    containerFinal = unico.id
    console.log(`\n  container da imagem: ${containerFinal}`)
  }

  // ## Esperar o container ficar pronto, e por que isto não é paranoia
  //
  // Criar o container só ENFILEIRA o trabalho: a Meta ainda vai buscar a
  // imagem na URL pública, e enquanto isso `media_publish` responde
  // `HTTP 400: Media ID is not available`.
  //
  // O primeiro post desta conta funcionou sem espera nenhuma, por sorte de
  // timing — o segundo falhou. Um erro que depende de quanto o servidor da
  // Meta demorou hoje é o pior tipo para deixar no script: passa em teste,
  // falha em uso, e a mensagem não diz o que aconteceu.
  //
  // `status_code` tem três valores: IN_PROGRESS, FINISHED e ERROR. Só o
  // segundo pode publicar; o terceiro traz o motivo em `status`.
  process.stdout.write('\n  aguardando o container ficar pronto')
  for (let tentativa = 1; ; tentativa++) {
    const { status_code: estado, status } = await graph(
      `/${containerFinal}?fields=status_code,status`,
    )
    if (estado === 'FINISHED') break
    if (estado === 'ERROR') throw new Error(`A Meta recusou a imagem: ${status ?? 'sem detalhe'}`)
    // 30 tentativas a 2s dão 60s. Uma peça de 1080x1350 fica pronta em poucos
    // segundos; passar de um minuto é sinal de problema na URL, não de espera.
    exigir(tentativa <= 30, 'O container não ficou pronto em 60s. Confira se a URL da arte é pública.')
    process.stdout.write('.')
    await new Promise((r) => setTimeout(r, 2000))
  }
  console.log(' pronto')

  const publicado = await graph(`/${conta.id}/media_publish?creation_id=${containerFinal}`, { method: 'POST' })
  console.log(`\n  PUBLICADO: ${publicado.id}`)
  console.log(`  https://www.instagram.com/velofunil/\n`)
}

main().catch((erro) => {
  console.error(`\n  ${erro.message}\n`)
  process.exit(1)
})

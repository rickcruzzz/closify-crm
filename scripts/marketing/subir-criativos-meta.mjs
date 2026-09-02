/**
 * Sobe as pecas de anuncio para a biblioteca de imagens da conta do Meta.
 *
 *     node --env-file=.env.local scripts/marketing/subir-criativos-meta.mjs
 *
 * ## Por que um script, e nao a ferramenta de upload do MCP
 *
 * `ads_creative_upload_media` aceita LOCAL_FILE (que abre um app interativo,
 * inutil aqui) ou URL publica (que estas pecas nao tem — `criativos/` fica
 * fora do Git e fora de `public/`, de proposito, porque e a pasta que a
 * Central do dono le). O endpoint `/adimages` aceita os bytes direto.
 *
 * ## O `hash` e o que importa, e ele e estavel
 *
 * O Meta deduplica por conteudo: subir a MESMA peca duas vezes devolve o
 * mesmo hash e nao cria copia. Entao rodar isto de novo depois de regerar as
 * artes e barato — so o que mudou de fato ocupa espaco novo.
 *
 * Escreve `criativos/anuncio/hashes.json`, que e o que o script da campanha
 * le. Esse arquivo esta fora do Git junto com o resto de `criativos/`.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PASTA = join(RAIZ, 'criativos', 'anuncio')
const CONTA = '1316925630418162'
const GRAPH = 'https://graph.facebook.com/v23.0'

const TOKEN = (process.env.META_ADS_TOKEN ?? '').trim()
if (!TOKEN) {
  console.error('META_ADS_TOKEN ausente. Rode com --env-file=.env.local')
  process.exit(1)
}

async function subir(caminho, nome) {
  const bytes = await readFile(caminho)
  const form = new FormData()
  form.set('access_token', TOKEN)
  form.set('bytes', bytes.toString('base64'))
  form.set('name', nome)

  const r = await fetch(`${GRAPH}/act_${CONTA}/adimages`, {
    method: 'POST',
    body: form,
  })
  const json = await r.json()
  if (json.error) throw new Error(`${nome}: ${json.error.message}`)

  // A resposta vem como { images: { "<nome do campo>": { hash, url } } }, e a
  // chave nao e o nome que mandamos — e por isso que se le o primeiro valor
  // em vez de indexar por `nome`.
  const primeira = Object.values(json.images ?? {})[0]
  if (!primeira?.hash) throw new Error(`${nome}: resposta sem hash`)
  return primeira.hash
}

const hashes = {}
let total = 0

for (const formato of ['4x5', '1x1', '9x16']) {
  const dir = join(PASTA, formato)
  let arquivos
  try {
    arquivos = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort()
  } catch {
    console.error(`pasta ausente: ${dir}. Rode gerar-anuncios.py antes.`)
    process.exit(1)
  }

  for (const arquivo of arquivos) {
    const peca = arquivo.replace('.png', '')
    const nome = `velofunil_${peca}_${formato}`
    const hash = await subir(join(dir, arquivo), nome)
    hashes[peca] ??= {}
    hashes[peca][formato] = hash
    total += 1
    console.log(`  ${formato.padEnd(4)} ${peca.padEnd(22)} ${hash}`)
  }
}

const destino = join(PASTA, 'hashes.json')
await writeFile(destino, JSON.stringify(hashes, null, 2) + '\n')
console.log(`\n${total} imagens na biblioteca da conta ${CONTA}`)
console.log(`hashes em ${destino}`)

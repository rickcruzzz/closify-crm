/**
 * Cria os criativos e os anuncios, com UMA IMAGEM POR POSICIONAMENTO.
 *
 *     node --env-file=.env.local scripts/marketing/criar-anuncios-meta.mjs
 *     node --env-file=.env.local scripts/marketing/criar-anuncios-meta.mjs --so a1_ancora_preco
 *
 * ## Por que nao pelo MCP
 *
 * `ads_create_creative` aceita uma imagem so (`image_hash`), ou video por
 * posicionamento (`placement_videos`) — nao ha equivalente para IMAGEM por
 * posicionamento. Com uma imagem so, o Meta recorta sozinho para os 15
 * posicionamentos que nao sao 4:5, e recorte automatico nao sabe onde esta o
 * texto.
 *
 * `asset_feed_spec` com `asset_customization_rules` e o mecanismo oficial
 * para isso, e so existe na Graph API.
 *
 * ## A regra de catch-all nao e opcional
 *
 * A ultima regra precisa cobrir tudo que as anteriores nao cobriram. Sem ela
 * a Meta recusa o creative — e com razao: um posicionamento sem regra e um
 * posicionamento sem imagem.
 *
 * ## Nasce tudo PAUSADO
 *
 * A campanha e o conjunto ja nasceram assim. Os anuncios seguem. Ligar e
 * decisao do dono, depois de ver os previews.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GRAPH = 'https://graph.facebook.com/v23.0'

// Conta nova, sem a restricao de Meta Pay que travava a antiga (09/09).
const CONTA = '924551593583617'
const PAGINA = '1105982245941400'
const INSTAGRAM = '17841439552855914'
const CONJUNTO = '120253684403670580'

const TOKEN = (process.env.META_ADS_TOKEN ?? '').trim()
if (!TOKEN) {
  console.error('META_ADS_TOKEN ausente. Rode com --env-file=.env.local')
  process.exit(1)
}

const { values: opcoes } = parseArgs({
  options: { so: { type: 'string' } },
  strict: false,
})

/** O destino, com UTM. `utm-capture.tsx` grava isso em `workspaces` — a ponte
 *  existe desde sempre e nunca foi exercitada, porque nenhuma campanha rodou. */
const destino = (peca) =>
  'https://www.velofunil.com.br/cadastro' +
  `?utm_source=meta&utm_medium=cpc&utm_campaign=aquisicao_cadastro&utm_content=${peca}`

/**
 * ## Os textos, um por angulo
 *
 * O texto principal e a arte dizem a MESMA tese por caminhos diferentes: quem
 * rola o feed le a arte, quem para le o texto. Dizer coisas diferentes nos
 * dois e o jeito mais rapido de a pessoa achar que clicou errado.
 *
 * O titulo tem teto de 40 caracteres e o texto principal corta em ~125 no
 * feed — passar disso esconde o argumento atras de "ver mais".
 */
const TEXTOS = {
  a1_ancora_preco: {
    corpo:
      'Cinco vendedores num CRM que cobra por pessoa custam R$ 300 por mes. ' +
      'Aqui e R$ 49 pela empresa inteira, com 1 ou com 20 pessoas.',
    titulo: 'R$ 49 pela empresa inteira',
    descricao: 'Sem cobrar por usuario',
  },
  a2_perda_memoria: {
    corpo:
      '42 horas e o tempo medio ate a primeira resposta. Nao e falta de ' +
      'vontade: e que a lista de quem esta esperando nao fica em lugar nenhum.',
    titulo: 'Nenhum cliente esquecido',
    descricao: 'O que fazer, e quando',
  },
  a3_objecao_planilha: {
    corpo:
      'Traga sua planilha do jeito que ela esta. O funil monta sozinho, e ' +
      'voce ve em um minuto quem esta parado e ha quanto tempo.',
    titulo: 'Sua planilha vira funil',
    descricao: 'Importa em um minuto',
  },
  a4_prova_produto: {
    corpo:
      'E isto: o funil inteiro, com o proximo passo e a data de cada cliente. ' +
      'Sem manual, sem instalar nada, sem treinamento.',
    titulo: 'Veja o funil por dentro',
    descricao: 'Simples como planilha',
  },
  a6_google: {
    corpo:
      'O compromisso cai na sua Agenda do Google e o e-mail sai do seu Gmail. ' +
      'Voce nao aprende ferramenta nova: usa as que ja usa, organizadas.',
    titulo: 'Funciona com o que voce ja usa',
    descricao: 'Agenda e Gmail conectados',
  },
  a5_oferta: {
    corpo:
      'Gratis ate 50 contatos, sem cartao e sem prazo para decidir. ' +
      'O Pro e R$ 49 por mes pela empresa inteira, e cancela sem multa.',
    titulo: 'Comece gratis, sem cartao',
    descricao: 'Pro por R$ 49/mes',
  },
}

/**
 * ## As regras de posicionamento
 *
 * A ordem importa: a Meta aplica a PRIMEIRA regra que casa. A ultima e o
 * catch-all e nao declara posicao nenhuma, so as plataformas — e por isso ela
 * pega tudo que sobrou.
 *
 * O 1:1 e o catch-all, e nao o 4:5, de proposito: quadrado e a proporcao que
 * menos perde em recorte, entao se um posicionamento novo aparecer no meio de
 * uma campanha rodando, ele recebe a peca que sofre menos.
 */
const REGRAS = [
  {
    rotulo: 'vertical_9x16',
    formato: '9x16',
    spec: {
      publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
      facebook_positions: ['story', 'facebook_reels'],
      instagram_positions: ['story', 'reels'],
      messenger_positions: ['story'],
      audience_network_positions: ['classic', 'rewarded_video'],
    },
  },
  {
    rotulo: 'feed_4x5',
    formato: '4x5',
    spec: {
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'video_feeds'],
      instagram_positions: ['stream', 'explore_home'],
    },
  },
  {
    rotulo: 'quadrado_1x1',
    formato: '1x1',
    spec: {
      // catch-all: sem `*_positions`, pega todo o resto de cada plataforma
      publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
    },
  },
]

async function chamar(caminho, corpo) {
  const r = await fetch(`${GRAPH}/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, access_token: TOKEN }),
  })
  const json = await r.json()
  if (json.error) {
    throw new Error(
      `${json.error.message}` +
        (json.error.error_user_msg ? ` | ${json.error.error_user_msg}` : ''),
    )
  }
  return json
}

const hashes = JSON.parse(
  await readFile(join(RAIZ, 'criativos', 'anuncio', 'hashes.json'), 'utf8'),
)

const feitos = []
for (const [peca, texto] of Object.entries(TEXTOS)) {
  if (opcoes.so && opcoes.so !== peca) continue

  const doPeca = hashes[peca]
  if (!doPeca) throw new Error(`${peca}: sem hash. Rode subir-criativos-meta.mjs`)

  const asset_feed_spec = {
    images: REGRAS.map((r) => ({
      hash: doPeca[r.formato],
      adlabels: [{ name: r.rotulo }],
    })),
    bodies: [{ text: texto.corpo }],
    titles: [{ text: texto.titulo }],
    descriptions: [{ text: texto.descricao }],
    link_urls: [{ website_url: destino(peca) }],
    call_to_action_types: ['SIGN_UP'],
    ad_formats: ['SINGLE_IMAGE'],
    asset_customization_rules: REGRAS.map((r, i) => ({
      customization_spec: r.spec,
      image_label: { name: r.rotulo },
      priority: i + 1,
    })),
  }

  const creative = await chamar(`act_${CONTA}/adcreatives`, {
    name: `Velo Funil — ${peca}`,
    object_story_spec: {
      page_id: PAGINA,
      instagram_user_id: INSTAGRAM,
    },
    asset_feed_spec,
    degrees_of_freedom_spec: {
      creative_features_spec: {
        standard_enhancements: { enroll_status: 'OPT_OUT' },
      },
    },
  })

  const anuncio = await chamar(`act_${CONTA}/ads`, {
    name: `Velo Funil — ${peca}`,
    adset_id: CONJUNTO,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  })

  feitos.push({ peca, creative: creative.id, anuncio: anuncio.id })
  console.log(`  ${peca.padEnd(22)} creative ${creative.id}  ad ${anuncio.id}`)
}

console.log(`\n${feitos.length} anuncios criados, todos PAUSADOS.`)
console.log('cada um com 3 imagens: 9:16 para Stories/Reels, 4:5 para feed,')
console.log('1:1 para o resto (catch-all).')

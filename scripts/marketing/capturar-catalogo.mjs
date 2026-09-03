/**
 * O catálogo visual do produto: toda tela, nos dois temas, em desktop e
 * telefone, mais uma página que mostra o conjunto.
 *
 * Uso, com o app de PRODUÇÃO rodando local (não `next dev`: as animações e o
 * bundle de dev não representam o que o cliente vê):
 *
 *     npm run build && npm run start -- -p 3970
 *     node --env-file=.env.local scripts/marketing/capturar-catalogo.mjs
 *
 * A saída vai para `C:/Users/orlan/OneDrive/Desktop/artes` por padrão, ou para
 * o caminho passado como primeiro argumento.
 *
 * ## Para que ele existe, e por que não é o mesmo dos prints da landing
 *
 * `scripts/capturar-prints-do-produto.mjs` captura QUATRO telas em 1440x900,
 * porque é o que a landing usa. Este aqui é matéria-prima para material de
 * marketing — post, Reel, anúncio — e por isso precisa de outra coisa:
 *
 *   toda tela           o designer escolhe, não o script
 *   telefone tambem     Reel e Story sao 9:16, e um print 16:10 recortado
 *                       ali perde a metade que importa
 *   3x no telefone      a peca final tem 1080px de largura; um print de
 *                       390px esticado ate la fica borrado
 *
 * Os dois COMPARTILHAM o cenário (`cenario-de-demonstracao.mjs`). Copiá-lo
 * faria os prints da landing e o material de marketing mostrarem produtos
 * ligeiramente diferentes, sem nada avisar.
 *
 * ## O que este script NÃO faz, de propósito
 *
 * Não recorta, não redimensiona e não comprime. O designer pede a imagem sem
 * perda para decidir o corte, e um script que já entrega recortado tira dele
 * exatamente a decisão que ele foi chamado para tomar.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

import { EMAIL, SENHA, apagarCenario, criarCenario } from './cenario-de-demonstracao.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3970'
const SAIDA = process.argv[2] ?? 'C:/Users/orlan/OneDrive/Desktop/artes'

/**
 * Refazer UMA tela sem refazer as 44.
 *
 *     SO_TELA=11-importar node --env-file=.env.local scripts/marketing/capturar-catalogo.mjs
 *
 * O catálogo inteiro leva ~6 minutos e recria o cenário do zero. Quando o
 * ajuste é numa tela só — calibrar um recorte, corrigir o estado em que ela é
 * fotografada — refazer tudo é o caminho mais caro para o mesmo resultado.
 *
 * O índice é reescrito apenas com o que ESTA execução capturou, então rodar
 * filtrado deixa o `index.html` parcial de propósito: ele descreve a rodada,
 * não a pasta.
 */
const SO_TELA = process.env.SO_TELA?.trim() || null

/**
 * 1440x900 é o desktop mais comum. 390x844 é o iPhone de referência, e é o
 * formato que vira Reel — a peça final tem 1080 de largura, então `3x` aqui
 * dá 1170px de pixel real, com folga.
 */
const FORMATOS = [
  // ## Por que 4x, e nao 2x
  //
  // A peca de carrossel usa um RECORTE da captura, ampliado ate encher o
  // card. Medido no `c1_capa`: um recorte de 1402x931 esticado para 1968x1328
  // e uma ampliacao de 1,40x, e a nitidez cai **41%** (variancia de bordas,
  // antes e depois). Interpolacao nao inventa detalhe — ela suaviza o que
  // falta, e o resultado le como print de print.
  //
  // A 4x o mesmo enquadramento sai de 2804x1862 e vai para 1968x1328
  // REDUZINDO, que e onde LANCZOS funciona bem. Sobra pixel para recortar,
  // que e a unica coisa que resolve o problema de verdade.
  //
  // Renderizar a peca inteira em HTML resolveria pelo mesmo mecanismo, e nao
  // por ser HTML: o que decide e ter pixel sobrando na origem. Um HTML
  // capturado a 1x teria exatamente este defeito — e custaria reescrever o
  // gerador inteiro, com as travas de contraste, ortografia, dado repetido,
  // ritmo da grade e zona segura de video que hoje moram nele.
  { nome: 'desktop', viewport: { width: 1440, height: 900 }, escala: 4 },
  { nome: 'telefone', viewport: { width: 390, height: 844 }, escala: 3 },
]

/**
 * `inteira` captura a página rolada até o fim: serve para tela que tem mais
 * conteúdo do que cabe na dobra e cujo valor está embaixo.
 *
 * ## A espera é pelo `h1`, e não pelo texto da tela
 *
 * A primeira versão esperava uma frase conhecida de cada tela ("Com quem
 * falar hoje", "Configurações"). Seis das 36 capturas falharam por timeout, e
 * o motivo é que a frase é frágil por natureza: ela muda quando alguém
 * reescreve a copy — o que aconteceu HOJE, nesta mesma sessão, com os
 * cabeçalhos das sete telas — e some quando o layout do telefone esconde o
 * elemento que a continha.
 *
 * Um catálogo que quebra sempre que a copy melhora não serve. O `h1` existe
 * em toda tela do produto e só é desenhado depois que ela monta, que é
 * exatamente a condição que interessa; o texto dele deixa de importar.
 */
const TELAS = [
  { rota: '/dashboard', nome: '01-resultados', inteira: true },
  { rota: '/kanban', nome: '02-funil' },
  { rota: '/leads', nome: '03-contatos' },
  { rota: '/hoje', nome: '04-hoje' },
  { rota: '/calendario', nome: '05-calendario' },
  { rota: '/conversas', nome: '06-conversas' },
  { rota: '/settings', nome: '07-empresa', inteira: true },
  { rota: '/settings/billing', nome: '08-plano', inteira: true },
  { rota: '/perfil', nome: '09-perfil' },

  // ## As duas telas abaixo existem para PREENCHER anúncio, não para o catálogo
  //
  // Medido em 03/09: as peças `a3_objecao_planilha` e `a6_google` tinham 30% e
  // 41% da arte VAZIOS — só o claim grande em cima e nada embaixo. É a mesma
  // classe do commit `c3ea81e` ("cinco dos sete slides estavam com metade da
  // peça vazia"), que voltou por outro caminho.
  //
  // O que preenche com valor é a tela real. As duas foram escolhidas por
  // responderem a objeção da peça em que entram, e não por caberem:
  //
  //     importar planilha   responde "e difícil migrar?" — mostrando que não é
  //     integrações         responde "vou ter que aprender outra ferramenta?"
  //
  // ## E a de integrações é segura para anúncio, o que foi CONFERIDO
  //
  // Ela nomeia "Google Calendar" e "Gmail" em texto e desenha ícone do Lucide
  // (`CalendarDays`, `Mail`) — traço genérico, NUNCA o logo do Google. Isso
  // importa: a Meta reprova criativo cujo visual sugira endosso ou parceria
  // não autorizada, e logo de terceiro na arte é exatamente esse caso. Nome em
  // texto, para uma integração que existe de verdade (verificação OAuth
  // aprovada pelo Google em 24/08), é uso nominativo factual e passa.
  { rota: '/settings?aba=integracoes', nome: '10-integracoes', inteira: true },
  { rota: '/leads', nome: '11-importar', acao: 'abrir-importacao' },
]

/**
 * Telas que não são uma rota, e sim um estado dentro dela.
 *
 * A importação de planilha é um diálogo (`import-leads-dialog.tsx`), não uma
 * página: navegar para `/leads` mostra a lista, não o importador. Sem isto o
 * catálogo teria a tela errada com o nome certo — que é pior que não tê-la,
 * porque ninguém confere print pelo nome do arquivo.
 */
const ACOES = {
  /**
   * Abre o importador E JÁ CARREGA uma planilha de exemplo.
   *
   * ## Por que não basta abrir o diálogo
   *
   * Aberto e vazio, ele mostra um seletor de arquivo nativo escrito
   * **"Choose File No file chosen"** — em inglês, porque o texto é do
   * navegador e não nosso. Num anúncio brasileiro isso sozinho já reprova a
   * imagem. Visto ao olhar a primeira captura, em 03/09.
   *
   * E o que vende não é o seletor: é o MAPEAMENTO. A promessa da peça é "sua
   * planilha entra, o funil monta sozinho", e quem prova isso é a tela em que
   * as colunas do arquivo já aparecem reconhecidas.
   *
   * Com o arquivo carregado o texto em inglês some junto — o input passa a
   * exibir o nome do arquivo.
   */
  async 'abrir-importacao'(page) {
    const botao = page.getByRole('button', { name: /importar/i }).first()
    await botao.waitFor({ state: 'visible', timeout: 20_000 })
    await botao.click()
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 20_000 })

    // Os nomes são fictícios de propósito: publicar planilha de cliente real
    // é tratamento de dado pessoal sem base legal, e é a mesma regra que
    // governa o cenário deste catálogo inteiro.
    const csv = [
      'Nome,E-mail,Telefone,Empresa,Valor',
      'Juliana Prado,juliana@vidaplena.com.br,71 98812-4400,Clinica Vida Plena,4500',
      'Carla Bastos,carla@bemestar.com.br,71 99120-8833,Clinica Bem Estar,2800',
      'Fernanda Rocha,fernanda@studioalva.com.br,71 98455-2019,Studio Alva,3600',
      'Marcos Vinicius,marcos@novaera.com.br,71 99733-1245,Agencia Nova Era,5100',
      'Eduardo Salles,eduardo@horizonte.com.br,71 98220-7788,Imobiliaria Horizonte,15000',
      'Patricia Lemos,patricia@primecon.com.br,71 99012-3344,Prime Consultoria,2800',
    ].join('\n')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'contatos.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    })

    // ## Esperar por "Conferir as colunas", e nao por /coluna/
    //
    // O passo INICIAL do dialogo ja diz "As colunas sao reconhecidas
    // sozinhas, voce so confere" — entao um seletor por /coluna/ casaria com
    // a tela de antes do arquivo e a captura sairia no estado errado, com o
    // seletor em ingles que esta correcao existe para eliminar.
    //
    // "Conferir as colunas" e o titulo do passo `colunas`, e so existe depois
    // que a planilha foi lida e os campos casados.
    await page
      .getByText(/conferir as colunas/i)
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(900)
  },
}

const capturadas = []
let cenario = null

try {
  cenario = await criarCenario()
  await mkdir(SAIDA, { recursive: true })

  const navegador = await chromium.launch()

  for (const formato of FORMATOS) {
    for (const tema of ['dark', 'light']) {
      const ctx = await navegador.newContext({
        viewport: formato.viewport,
        deviceScaleFactor: formato.escala,
        locale: 'pt-BR',
        isMobile: formato.nome === 'telefone',
        hasTouch: formato.nome === 'telefone',
      })
      const page = await ctx.newPage()

      // Semear ANTES de navegar: o next-themes lê do localStorage, e sem isso
      // o primeiro quadro sai no tema padrão.
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), tema)
      // O banner de consentimento nasce no rodapé de QUALQUER rota enquanto
      // ninguém responde, inclusive das telas de dentro. Um aviso de LGPD
      // atravessado no material mostra o produto discutindo consentimento em
      // vez de trabalhando. Responder aqui não altera o que a tela desenha.
      await page.addInitScript(() =>
        window.localStorage.setItem('vf_consentimento_v1', 'recusado'),
      )

      await page.goto(`${BASE}/login`)
      await page.locator('#email').fill(EMAIL)
      await page.locator('#password').fill(SENHA)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await page.waitForURL('**/dashboard', { timeout: 60_000 })

      for (const tela of TELAS) {
        if (SO_TELA && tela.nome !== SO_TELA) continue
        const arquivo = `${tela.nome}-${formato.nome}-${tema}.png`
        try {
          await page.goto(`${BASE}${tela.rota}`, { waitUntil: 'networkidle' })
          await page.locator('h1').first().waitFor({ state: 'visible', timeout: 45_000 })
          // Rede parada não basta: as animações de entrada ainda correm, e um
          // print no meio delas pega o conteúdo translúcido e deslocado.
          await page.waitForTimeout(1400)
          // Tela que é um ESTADO da rota, e não a rota: abre o diálogo antes
          // de fotografar. Falhar aqui não pode passar em silêncio — o print
          // sairia com o nome do importador e a imagem da lista.
          if (tela.acao) await ACOES[tela.acao](page)
          await page.screenshot({
            path: `${SAIDA}/${arquivo}`,
            fullPage: Boolean(tela.inteira),
          })
          capturadas.push({ ...tela, formato: formato.nome, tema, arquivo })
          console.log(`ok  ${arquivo}`)
        } catch (erro) {
          // Uma tela que falha não derruba o catálogo: as outras continuam
          // valendo, e o índice mostra o buraco em vez de escondê-lo.
          console.log(`FALHOU  ${arquivo}  ${String(erro).split('\n')[0].slice(0, 90)}`)
        }
      }
      await ctx.close()
    }
  }

  await navegador.close()
  await writeFile(`${SAIDA}/index.html`, montarIndice(capturadas), 'utf-8')
  console.log(`\n${capturadas.length} imagens + index.html em ${SAIDA}`)
} finally {
  if (cenario) await apagarCenario(cenario)
}

/**
 * A página que o designer abre.
 *
 * As imagens são referenciadas por caminho relativo, não embutidas em base64:
 * embutir dobraria o peso e, principalmente, tiraria dele o arquivo original
 * para arrastar para dentro da ferramenta de edição.
 *
 * Ela agrupa por TELA e não por formato, porque a decisão do designer é
 * "que tela conta esta história" antes de "em que proporção" — e ver desktop
 * e telefone lado a lado é o que mostra o que sobrevive ao recorte 9:16.
 */
function montarIndice(imagens) {
  const porTela = new Map()
  for (const img of imagens) {
    if (!porTela.has(img.nome)) porTela.set(img.nome, [])
    porTela.get(img.nome).push(img)
  }

  const secoes = [...porTela.entries()]
    .map(([nome, itens]) => {
      const titulo = nome.replace(/^\d+-/, '').replace(/-/g, ' ')
      const cartoes = itens
        .sort((a, b) => a.formato.localeCompare(b.formato) || a.tema.localeCompare(b.tema))
        .map(
          (i) => `
        <figure class="peca ${i.formato}">
          <a href="${i.arquivo}" target="_blank"><img src="${i.arquivo}" alt="${titulo}" loading="lazy"></a>
          <figcaption>${i.formato} · ${i.tema === 'dark' ? 'escuro' : 'claro'}<br><code>${i.arquivo}</code></figcaption>
        </figure>`,
        )
        .join('')
      return `<section><h2>${titulo}</h2><div class="grade">${cartoes}</div></section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Velo Funil — catálogo de telas</title>
<style>
  :root { --fundo:#042021; --card:#06292a; --texto:#fcfcfc; --apoio:#96acac; --teal:#00bfc0; --borda:#0a3d3e; }
  * { box-sizing: border-box; }
  body { margin:0; padding:40px 28px 80px; background:var(--fundo); color:var(--texto);
         font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  header { max-width:1200px; margin:0 auto 48px; }
  h1 { font-size:38px; letter-spacing:-.02em; margin:0 0 12px; }
  .sub { color:var(--apoio); max-width:70ch; margin:0 0 20px; }
  .aviso { border-left:3px solid var(--teal); padding:12px 16px; background:#06292a;
           border-radius:0 8px 8px 0; color:var(--apoio); max-width:70ch; font-size:14px; }
  section { max-width:1200px; margin:0 auto 56px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.14em; color:var(--teal);
       border-bottom:1px solid var(--borda); padding-bottom:10px; margin:0 0 20px; }
  .grade { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:22px; align-items:start; }
  .peca { margin:0; background:var(--card); border:1px solid var(--borda); border-radius:12px;
          overflow:hidden; }
  .peca.telefone { max-width:230px; }
  .peca img { display:block; width:100%; height:auto; }
  figcaption { padding:10px 12px; font-size:12px; color:var(--apoio); }
  code { color:var(--teal); font-size:11px; word-break:break-all; }
  @media (prefers-color-scheme: light) {
    :root { --fundo:#f6f8f9; --card:#fff; --texto:#0a0a0a; --apoio:#5e6565; --teal:#00787a; --borda:#d9dcdd; }
    .aviso { background:#fff; }
  }
</style></head>
<body>
<header>
  <h1>Velo Funil — catálogo de telas</h1>
  <p class="sub">Todas as telas do produto, nos dois temas, em desktop (1440&times;900 a 2&times;) e
  telefone (390&times;844 a 3&times;). Nenhuma imagem foi recortada, redimensionada ou comprimida:
  o corte é decisão de quem for montar a peça.</p>
  <p class="aviso"><strong>Os dados são fictícios.</strong> "Acme Corp" e os contatos são um
  cenário criado só para a captura e apagado logo depois. Nenhuma tela aqui mostra dado de
  cliente real, e nenhuma deve: nome, telefone e valor de negócio numa peça pública seriam
  tratamento de dado pessoal de terceiro sem base legal.</p>
</header>
${secoes}
</body></html>
`
}

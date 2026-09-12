/** @type {import('next').NextConfig} */

// Content Security Policy, em modo BLOQUEIO desde 27/08/2026.
//
// A abordagem "correta" no papel é nonce por requisição gerado no middleware,
// com `strict-dynamic`. Foi tentada e medida: como as páginas públicas são
// estáticas (HTML gerado no build), não existe requisição para carimbar o
// nonce, e `strict-dynamic` faz o navegador ignorar qualquer fallback. O
// resultado foram 28 a 32 violações por página, todos os chunks do próprio
// Next. Ativar aquela política derrubaria o app inteiro.
//
// Usar nonce exigiria tornar cada página dinâmica, o que anularia o ganho de
// TTFB de manter a landing estática. A troca não compensa: o que uma CSP com
// nonce adiciona sobre esta aqui é defesa contra XSS inline, e o app não
// injeta HTML de terceiros em lugar nenhum.
//
// Esta política entrega o que dá para entregar sem regressão, e, diferente da
// versão com nonce, virou bloqueio de verdade — ver o comentário do header,
// mais abaixo, para o que travava e como foi medido antes de ligar.
//
// Estado medido com esta política: 1 violação por página, sempre a mesma,
// `eval` num chunk de dependência (o bundle onde ela aparece carrega zod,
// @base-ui/react e lucide), padrão típico de polyfill de `globalThis` em
// código empacotado. Antes de trocar para modo bloqueio é preciso decidir
// entre adicionar `'unsafe-eval'` (o que enfraquece bastante a diretiva) ou
// isolar qual dependência faz isso e trocá-la.
/**
 * O `next dev` NÃO consegue rodar sem `eval`.
 *
 * O webpack de desenvolvimento envolve cada módulo em `eval()` para dar
 * source map por módulo — é assim que ele funciona, não é opção de
 * configuração. Com a CSP em bloqueio e sem `'unsafe-eval'`, o navegador
 * recusa o bundle inteiro: `EvalError` no console, **o React nunca hidrata**,
 * e nenhum botão, formulário ou diálogo responde em `localhost`.
 *
 * Medido em 30/08, e o efeito é maior que "atrapalha o desenvolvimento":
 * o formulário de login passa a submeter NATIVAMENTE, virando
 * `GET /login?email=...&password=...` — com a senha na URL, no histórico e no
 * `Referer`.
 *
 * A política virou bloqueio em 27/08 e ninguém percebeu porque a prova daquele
 * dia rodou contra produção, onde o build **não** usa `eval` e a CSP está
 * correta como está.
 *
 * `'unsafe-eval'` entra SÓ em desenvolvimento. Em produção a diretiva
 * permanece exatamente como estava — que é onde ela protege alguém.
 */
const emDesenvolvimento = process.env.NODE_ENV === 'development'

/**
 * Os hosts do Google Ads, e por que eles precisam estar aqui ANTES da tag.
 *
 * ## O modo de falha que isto evita
 *
 * A CSP deste projeto é bloqueio de verdade desde 27/08 (ver o comentário do
 * header, abaixo). Um `gtag.js` servido de `www.googletagmanager.com` sem esta
 * entrada é **recusado em silêncio**: sem erro na tela, sem teste falhando, com
 * o registro só no console de quem estivesse olhando.
 *
 * A campanha rodaria, o dinheiro sairia, e o painel do Google mostraria zero
 * conversão — erro de configuração com **aparência de anúncio ruim**. A decisão
 * seguinte seria pausar a campanha que funciona.
 *
 * É a mesma classe que já custou caro aqui três vezes: a logo do Storage
 * bloqueada por esta mesma CSP, o pixel com quebra de linha colada na Vercel, e
 * o `robots.txt` do Cloudflare com 76 linhas contra 15 no código. **Configuração
 * fora do repositório que mudaria o comportamento do produto.**
 *
 * Por isso `scripts/marketing/auditar-descoberta.mjs` confere este header na
 * RESPOSTA REAL, por HTTP. "A tag está no código" e "a tag consegue carregar"
 * são duas coisas diferentes, e é a segunda que gasta dinheiro.
 */
const GTAG = 'https://www.googletagmanager.com'

/**
 * Para onde o ping de conversão sai depois que o `gtag` carrega.
 *
 * `www.google.com.br` entra junto do `.com` porque o Google manda o ping pelo
 * TLD do país de quem clicou, e o alvo daqui é o Brasil inteiro. Omitir o
 * `.com.br` perderia exatamente as conversões que a campanha existe para medir.
 *
 * ## `www.googleadservices.com` entrou DEPOIS de a conversão quase se perder
 *
 * A primeira lista tinha os três acima e passou na prova ponta a ponta — mas o
 * console de produção contava outra história. Medido em 05/09, com conta
 * descartável caminhando até `/bem-vindo`:
 *
 *     BLOQUEADO  www.googleadservices.com/pagead/conversion/…&en=conversion
 *                &label=L3G3CPfg…                            connect-src
 *     PASSOU     www.google.com/pagead/1p-conversion/…&en=conversion   302
 *                www.google.com.br/…                                  200
 *
 * O `gtag` tenta o `googleadservices.com` PRIMEIRO e cai para o
 * `google.com/1p-conversion` quando falha. A conversão chegou — pelo caminho
 * reserva.
 *
 * Isso não é "violação esperada e inofensiva", que é o caso das duas do Meta
 * Pixel: lá foi medido que **nenhum** evento se perdia. Aqui o evento só
 * sobreviveu porque existe um segundo caminho, e depender de um fallback de
 * terceiro para a única métrica que a campanha produz é fragilidade — no dia em
 * que o Google mudar a ordem, as conversões somem sem nada falhar.
 *
 * ## O que ficou de fora, e por quê
 *
 * `googleads.g.doubleclick.net` em **script-src**: o `gtag` tentou carregar o
 * ping de configuração como SCRIPT (`fmt=4`), foi recusado, e refez como imagem
 * (`fmt=3`, HTTP 302 → 200). Abrir `script-src` para um host de anúncio é
 * permitir execução de código arbitrário vindo dele — preço alto demais por um
 * ping que já chega por outro formato, e que nem é a conversão.
 *
 * `ad.doubleclick.net/ccm/s/collect`: coleta de remarketing entre domínios.
 * Este projeto não faz remarketing, e o evento de conversão não passa por lá.
 */
const PING_DE_CONVERSAO =
  'https://googleads.g.doubleclick.net https://www.googleadservices.com ' +
  'https://www.google.com https://www.google.com.br'

const csp = [
  "default-src 'self'",
  // `unsafe-inline` é inevitável enquanto as páginas forem estáticas: o Next
  // embute o payload de hidratação em script inline. Mesmo assim a diretiva
  // vale, porque bloqueia script vindo de origem externa. `connect.facebook.net`
  // é o loader do Meta Pixel (components/analytics/meta-pixel.tsx), só nas
  // páginas públicas, mas a CSP é do site inteiro, não dá pra restringir por rota.
  `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ''} https://connect.facebook.net ${GTAG}`,
  // O next-themes escreve `style` inline no elemento raiz antes da hidratação
  // para evitar flash de tema; sem `unsafe-inline` a página perde formatação.
  "style-src 'self' 'unsafe-inline'",
  // `www.facebook.com` é o beacon de rastreamento do Pixel (`/tr?id=...`),
  // carregado como `<img>` no `<noscript>` de quem desativa JS.
  //
  // O Supabase entra aqui pelo mesmo motivo que já entrava em `connect-src`, e
  // a ausência custou caro: **arquivo do Storage é servido pelo domínio do
  // projeto, não pelo nosso**. Toda imagem vinda de `createSignedUrl` estava
  // sendo bloqueada em produção desde 27/08, quando a política virou bloqueio.
  //
  // O que quebrava, e ninguém viu: a **logo da empresa** em Configurações →
  // Empresa (`logo-upload.tsx` usa `<img>` com URL assinada, de propósito —
  // `next/image` não serve para URL que expira em uma hora) e os anexos dos
  // relatos de suporte. Nos dois casos a imagem simplesmente não aparecia,
  // sem erro na tela: a CSP recusa em silêncio, e o registro fica só no
  // console do navegador de quem estivesse olhando.
  //
  // Lido da mesma variável de `connect-src` em vez de escrito à mão: o
  // projeto do Supabase já mudou uma vez (a migração para São Paulo, em
  // 12/08), e um host fixo aqui voltaria a quebrar na próxima.
  `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://www.facebook.com ${GTAG} ${PING_DE_CONVERSAO}`,
  "font-src 'self'",
  // Supabase por HTTPS e por WebSocket (realtime), e o Meta Pixel manda o
  // evento de rastreamento por fetch/beacon pra www.facebook.com quando JS
  // está ativo (o `<img>` do noscript acima cobre só quem desativou).
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} ${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace('https://', 'wss://')} https://www.facebook.com ${GTAG} ${PING_DE_CONVERSAO}`,
  // ## As duas violações do Meta Pixel são ESPERADAS. Não "conserte".
  //
  // Com o pixel ativo, o console registra duas recusas em `/cadastro`:
  //
  //     form-action   POST para https://www.facebook.com/tr/
  //     frame-src     iframe de https://www.facebook.com
  //
  // Parecem perda de medição e não são. Medido em produção, no navegador:
  //
  //     PageView                        GET 200   passa
  //     ViewContent (parametros reais)  GET 200   passa, ZERO violacao
  //     payload artificial de 3000 ch   bloqueado
  //
  // O `fbevents.js` manda por GET enquanto a query cabe (~2 KB) e só então
  // troca por POST num `<form>` oculto. **Nenhum evento deste projeto chega
  // perto desse tamanho**, e os três de compra (`InitiateCheckout`,
  // `AddPaymentInfo`, `Purchase`) são Conversions API — nem passam pelo
  // navegador, por decisão de 21/08 que bloqueia o pixel na área logada.
  //
  // Abrir `form-action` para o Facebook custaria a diretiva que impede um XSS
  // de exfiltrar dado por submit de formulário — em troca de zero evento
  // recuperado. O `fbp` continua sendo gerado sem o iframe, conferido na
  // própria requisição que chega com 200.
  //
  // ## O Google Ads segue a MESMA disciplina, e por isso `frame-src` fica fechado
  //
  // O `gtag` moderno manda a conversão por `img`/`fetch`, que as duas diretivas
  // acima já cobrem. Implementações antigas caíam num iframe de
  // `googleads.g.doubleclick.net`, e abri-lo preventivamente seria pagar uma
  // diretiva de segurança por um caminho que talvez nem exista aqui.
  //
  // A ordem é a mesma que tornou seguro ligar esta CSP: **medir primeiro**. Se
  // o console de produção acusar recusa de `frame-src` E uma conversão real se
  // perder, abre-se então — com o número na mão, não por precaução.
  "form-action 'self'",
  // Redundante com X-Frame-Options, mas é a diretiva moderna e vale manter.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
]
  .join('; ')
  .replace(/\s+/g, ' ')
  .trim()

const securityHeaders = [
  /**
   * BLOQUEIO de verdade, desde 27/08/2026. Antes disso viveu em Report-Only.
   *
   * O que travava era UMA violação por página, sempre a mesma, sempre
   * `script-src`/`eval`. Rastreada até a origem em produção:
   *
   *     chunks/6058-….js:62
   *     try { return Function(""), true } catch (e) { return false }
   *
   * O `allowsEval` do Zod v4 — sondagem de recurso, não uso: uma chamada
   * dentro de `try/catch` só para descobrir se o ambiente compila validador
   * com JIT. O `catch` já engolia a falha e o Zod seguia pelo caminho
   * interpretado; o navegador reportava assim mesmo, porque a tentativa
   * aconteceu. `lib/validations/zod.ts` desliga a sondagem, e ela sumiu.
   *
   * Medido ANTES de trocar este header, ainda em Report-Only: 15 rotas
   * (públicas e logadas) mais o envio de um formulário real, onde o Zod
   * constrói e roda schema no cliente. Zero violações em todas.
   *
   * A ordem era o que tornava isto seguro. Ligar antes de medir é como este
   * projeto já derrubou o site inteiro uma vez, com a quebra de linha no ID
   * do Pixel: tela preta para todo mundo que aceitasse os cookies.
   *
   * `upgrade-insecure-requests` entra agora — o navegador a ignora em
   * Report-Only, então em modo bloqueio ela passa a ter efeito.
   */
  { key: 'Content-Security-Policy', value: csp },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  poweredByHeader: false,

  /**
   * Atalhos por canal, para o link publicado ficar limpo E rastreável.
   *
   * ## O problema que isto resolve
   *
   * A bio do Instagram precisava do link com UTM para a atribuição funcionar:
   * medido em 31/08, apenas **2 de 42 empresas** têm origem registrada, e sem
   * marcar o link o orgânico publicado fica invisível — daqui a um mês a
   * pergunta "valeu a pena postar?" não teria resposta.
   *
   * Mas a URL com query string inteira na bio é feia e lê como link de
   * rastreamento, que é justamente o que as pessoas aprenderam a desconfiar.
   * Era uma escolha entre medir e parecer confiável.
   *
   * `velofunil.com.br/ig` resolve as duas: curto no perfil, e o redirect
   * acrescenta as UTMs antes de a página carregar. `utm-capture.tsx` grava
   * normalmente, porque para ele a URL final é a que importa.
   *
   * ## Por que `permanent: false`
   *
   * 307, não 308. Redirect permanente fica no cache do navegador e do
   * Cloudflare para sempre — trocar a campanha depois exigiria que cada
   * visitante limpasse o cache. Com temporário, mudar a UTM é editar esta
   * linha.
   *
   * ## O custo, medido
   *
   * Um salto a mais: ~250ms contra os ~980ms que o domínio SEM `www` já
   * custava antes de existir atalho nenhum. Continua mais rápido que o que
   * estava na bio até hoje.
   */
  async redirects() {
    const paraCanal = (slug, fonte, medium, campanha) => ({
      source: `/${slug}`,
      destination:
        `/?utm_source=${fonte}&utm_medium=${medium}&utm_campaign=${campanha}`,
      permanent: false,
    })

    return [
      paraCanal('ig', 'instagram', 'bio', 'perfil'),
      /**
       * ## `/wa`, o link da prospecção por WhatsApp
       *
       * A mensagem carregava `https://velofunil.com.br/?utm_source=whatsapp`
       * — 44 caracteres de query crua no fim de um texto escrito para parecer
       * uma pessoa falando. O dono apontou isso olhando a conversa.
       *
       * Três coisas melhoram de uma vez, e a terceira é a que importa:
       *
       *     aparencia   `www.velofunil.com.br/wa` le como endereco, e
       *                 `?utm_source=` le como rastreamento
       *     tamanho     44 -> 31 caracteres
       *     o `www`     em 12/09 eu MEDI que nao dava para acrescenta-lo: a
       *                 mensagem mais longa ja estava em 560, o teto, e com
       *                 `www.` ia a 564 — 59 das 837 seriam cortadas em
       *                 silencio por `truncarPreservando`. Com o atalho sobra
       *                 folga, e o link canonico deixa de pagar os 259ms do
       *                 redirecionamento de dominio
       *
       * **Ganha `utm_medium` e `utm_campaign`, que o link antigo não tinha.**
       * `cruzarCampanhasComClientes` agrupa por campanha, então sem eles a
       * prospecção caía no balde de "sem campanha identificada" junto com o
       * tráfego orgânico — e a pergunta "as 837 mensagens trouxeram alguém?"
       * não tinha como ser respondida.
       *
       * Temporário e não permanente, pela mesma razão escrita acima para o
       * `/ig`: 308 fica no cache do navegador para sempre, e mudar a UTM
       * depois exigiria que cada visitante limpasse o cache.
       */
      paraCanal('wa', 'whatsapp', 'prospeccao', 'prospeccao_2026_09'),
    ]
  },
  /**
   * Para onde o build escreve.
   *
   * ## Por que isto é configurável
   *
   * `next build` e `next dev` usam a MESMA pasta `.next` por padrão. Rodar o
   * build com o servidor de desenvolvimento de pé sobrescreve o mapa de chunks
   * que ele está usando, e a partir daí toda rota morre com
   * `MODULE_NOT_FOUND` em `webpack-runtime.js` — sem que nada no código esteja
   * errado. O sintoma é cruel: o erro aponta para o arquivo de rota, então
   * parece defeito da última coisa que você escreveu.
   *
   * Aconteceu três vezes numa sessão só, porque a conferência antes de fechar
   * qualquer mudança neste projeto inclui `npm run build` — ou seja, o próprio
   * gate derrubava o localhost do dono.
   *
   * `npm run build:check` passa `BUILD_DIR=.next-check` e o build vai para
   * outra pasta, sem encostar na do desenvolvimento. `npm run build` continua
   * escrevendo em `.next`, que é o que a Vercel espera.
   */
  distDir: process.env.BUILD_DIR || '.next',
  /**
   * AVIF antes de WebP.
   *
   * O padrão do Next 14 é `['image/webp']` e mais nada — medido em produção em
   * 03/09: pedindo `Accept: image/avif,image/webp`, a resposta voltava
   * `Content-Type: image/webp`. O navegador dizia que aceitava AVIF e recebia
   * WebP mesmo assim.
   *
   * A ordem importa: o Next serve o PRIMEIRO formato da lista que o navegador
   * aceita, então `avif` antes de `webp` é o que faz o AVIF ser escolhido, e o
   * WebP continua atendendo quem não aceita AVIF (Safari abaixo de 16.4, e
   * qualquer bot).
   *
   * O caso deste projeto é o melhor possível para AVIF: as imagens são prints
   * de interface — texto pequeno sobre fundo chapado —, que é onde a
   * compressão com perda mais desperdiça bits e onde o AVIF mais se distancia
   * do WebP. São 259 KB de imagem no telefone hoje (`produto-print.tsx`), e é
   * o item mais pesado da landing depois do JavaScript.
   *
   * O custo é a primeira codificação, que é lenta e acontece uma vez por
   * variante — as imagens são `loading="lazy"` e vivem abaixo da dobra, então
   * quem paga essa espera não é quem decide se o site é rápido.
   */
  /**
   * O degrau de 3840 sai da lista, e isso é o que de fato corta os bytes.
   *
   * O padrão do Next termina em 3840. O `sizes` de `produto-print.tsx` declara
   * a largura em CSS px, e o navegador MULTIPLICA por DPR antes de escolher o
   * degrau — então um telefone comum (DPR 2) pedia 2050 e caía no 3840,
   * enquanto o comentário daquele arquivo dizia, desde 24/08, que o alvo era
   * "2048, uma folga de 1,77x". A intenção estava escrita e não era o que
   * acontecia.
   *
   * Medido em produção em 03/09, o que muda no telefone:
   *
   *     kanban-dark   w3840 169.042 -> w2048 115.968
   *     hoje-dark     w3840  89.948 -> w2048  60.458
   *                        259,0 KB -> 176,4 KB   (-32%)
   *
   * Cortar acima de 2048 não perde nada aqui porque **`produto-print.tsx` é o
   * único consumidor de `next/image` do projeto** (conferido), e a fonte tem
   * 2880px de largura: o degrau de 3840 nunca entregou 3840 pixels, entregou
   * os mesmos 2880 recodificados mais caro.
   */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  // Cache do Router do lado do cliente, explícito. O padrão para rota
  // dinâmica mudou entre versões do Next, sem isto, voltar para uma tela do
  // dashboard recém-visitada (ex: Kanban → Leads → Kanban) refaz a busca no
  // servidor mesmo sem nada ter mudado. 30s cobre o vaivém comum entre telas
  // do produto; passado isso, busca de novo, dado de CRM muda o tempo todo.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
    serverActions: {
      /**
       * ## O teto de corpo da Server Action, e a promessa que ele desmentia
       *
       * O padrao do Next e **1 MB**. O dialogo de suporte
       * (`components/feedback/dialogo-de-feedback.tsx`) anuncia na tela
       * "PNG, JPG, WEBP ou PDF ate 10 MB", aceita ate 3 arquivos
       * (`ANEXO_QUANTIDADE_MAXIMA`), e valida os 10 MB no navegador antes de
       * enviar. Ou seja: a tela aprovava ate 30 MB e o servidor recusava a
       * partir de 1.
       *
       * A recusa nao vinha como `{ error }` — a Server Action REJEITA, e sem
       * `try/catch` no chamador isso virava o botao girando para sempre.
       * Reportado com print em 02/09, e as duas metades foram corrigidas
       * juntas: sem o `catch` a pessoa nao ve mensagem nenhuma; sem este
       * limite ela ve a mensagem, mas o anexo continua sem passar.
       *
       * 32 MB e a conta da propria UI (3 x 10 MB) mais folga para o resto do
       * `FormData` e para a sobrecarga de multipart. Escrito em MB de
       * proposito: a unidade que a tela promete e a unidade que o servidor
       * aceita, para a divergencia ser visivel na leitura.
       *
       * Isto NAO substitui a validacao de `lib/feedback/actions.ts`, que
       * confere tipo pelos BYTES iniciais e tamanho arquivo a arquivo. Este
       * numero e o teto do transporte; aquele e a regra.
       */
      bodySizeLimit: '32mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.playwright-mcp/**'],
    }
    return config
  },
}

export default nextConfig

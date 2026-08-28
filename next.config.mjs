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
const csp = [
  "default-src 'self'",
  // `unsafe-inline` é inevitável enquanto as páginas forem estáticas: o Next
  // embute o payload de hidratação em script inline. Mesmo assim a diretiva
  // vale, porque bloqueia script vindo de origem externa. `connect.facebook.net`
  // é o loader do Meta Pixel (components/analytics/meta-pixel.tsx), só nas
  // páginas públicas, mas a CSP é do site inteiro, não dá pra restringir por rota.
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  // O next-themes escreve `style` inline no elemento raiz antes da hidratação
  // para evitar flash de tema; sem `unsafe-inline` a página perde formatação.
  "style-src 'self' 'unsafe-inline'",
  // `www.facebook.com` é o beacon de rastreamento do Pixel (`/tr?id=...`),
  // carregado como `<img>` no `<noscript>` de quem desativa JS.
  "img-src 'self' data: blob: https://www.facebook.com",
  "font-src 'self'",
  // Supabase por HTTPS e por WebSocket (realtime), e o Meta Pixel manda o
  // evento de rastreamento por fetch/beacon pra www.facebook.com quando JS
  // está ativo (o `<img>` do noscript acima cobre só quem desativou).
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} ${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace('https://', 'wss://')} https://www.facebook.com`,
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
  // Cache do Router do lado do cliente, explícito. O padrão para rota
  // dinâmica mudou entre versões do Next, sem isto, voltar para uma tela do
  // dashboard recém-visitada (ex: Kanban → Leads → Kanban) refaz a busca no
  // servidor mesmo sem nada ter mudado. 30s cobre o vaivém comum entre telas
  // do produto; passado isso, busca de novo, dado de CRM muda o tempo todo.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
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

/**
 * `next build` que NÃO derruba o `npm run dev` que estiver rodando.
 *
 *   npm run build:check
 *
 * ## O problema que isto resolve
 *
 * `next build` e `next dev` escrevem na mesma pasta `.next`. Rodar o build com
 * o servidor de desenvolvimento de pé sobrescreve o mapa de chunks que ele está
 * usando, e a partir daí toda rota morre com `MODULE_NOT_FOUND` em
 * `webpack-runtime.js`.
 *
 * O sintoma engana: o erro aponta para o arquivo da rota, então parece defeito
 * da última coisa que você escreveu. Aconteceu **três vezes numa sessão só**,
 * porque a conferência antes de fechar qualquer mudança neste projeto inclui
 * `npm run build` — ou seja, o próprio gate derrubava a Central do dono, que
 * fica aberta em localhost o tempo todo.
 *
 * Aqui o build vai para `.next-check`, lido por `distDir` em `next.config.mjs`.
 * O `npm run build` continua escrevendo em `.next`, que é o que a Vercel
 * espera — esta variante é só para conferir localmente.
 *
 * ## Por que um script em Node, e não a variável na linha do npm
 *
 * `BUILD_DIR=.next-check next build` é sintaxe de shell POSIX. O `script-shell`
 * deste projeto é nulo, então no Windows o npm usa o `cmd`, que interpreta isso
 * como um comando chamado `BUILD_DIR=.next-check` e falha. `cross-env` seria
 * uma dependência nova para uma linha; o Node já sabe fazer isso.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PASTA = '.next-check'

/**
 * Teto do cache do webpack, em MB.
 *
 * ## Por que podar, e por que NÃO podar sempre
 *
 * Medido em 12/09: `.next-check` tinha **725 MB, dos quais 706 eram cache**,
 * em 65 arquivos acumulados desde 09/09. Três dias de `build:check` — e o
 * script nunca limpou nada, porque limpar não era trabalho de ninguém.
 *
 * O projeto mora dentro do OneDrive, então cada byte aqui é byte que o
 * sincronizador tenta subir. Somado a `.next` (245 MB), `node_modules`
 * (541 MB em 46 mil arquivos) e `.git` (211 MB), o repositório ocupava ~1,7 GB
 * de pasta sincronizada — quase metade disso em artefato descartável.
 *
 * **Apagar a cada build seria a correção óbvia e errada.** O cache é o que faz
 * o build de conferência levar segundos em vez de minutos: sem ele, todo
 * `build:check` recompila o mundo, e o gate antes de cada commit ficaria caro
 * o bastante para alguém começar a pular.
 *
 * O teto resolve os dois: o uso normal mantém a aceleração, e o crescimento
 * sem fim para. 300 MB cobre com folga um build inteiro deste projeto.
 */
const TETO_DE_CACHE_MB = 300

function podarCacheSeCrescerDemais() {
  const cache = join(PASTA, 'cache')
  if (!existsSync(cache)) return

  // Soma recursiva: o cache do webpack guarda poucos arquivos GRANDES, então
  // contar arquivos não diria nada — 65 deles somavam 706 MB.
  const tamanho = (dir) => {
    let total = 0
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      const st = statSync(caminho)
      total += st.isDirectory() ? tamanho(caminho) : st.size
    }
    return total
  }

  const mb = Math.round(tamanho(cache) / 1024 / 1024)
  if (mb <= TETO_DE_CACHE_MB) return

  console.log(`  cache de build em ${mb} MB (teto ${TETO_DE_CACHE_MB}). Podando.`)
  rmSync(cache, { recursive: true, force: true })
  console.log('  este build vai demorar mais; os proximos voltam ao normal.')
}

podarCacheSeCrescerDemais()

const resultado = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BUILD_DIR: PASTA },
  // O `next` real é um `.cmd` no Windows, e sem shell o spawn não o encontra.
  shell: true,
})

if (resultado.error) {
  console.error('Não consegui rodar o build:', resultado.error.message)
  process.exit(1)
}

process.exit(resultado.status ?? 1)

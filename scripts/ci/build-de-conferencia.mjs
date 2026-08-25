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

const PASTA = '.next-check'

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

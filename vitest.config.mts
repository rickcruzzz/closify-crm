import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// `import.meta.dirname` em vez de `__dirname`: o carregador nativo do Vite não
// define `__dirname` em arquivo ESM, e avisa a cada execução.
const raizDoProjeto = import.meta.dirname

/**
 * Testes de unidade da lógica pura — schemas de validação, parser de CSV,
 * medidor de força e formatadores.
 *
 * Deliberadamente sem jsdom e sem testes de componente: o que quebrou de
 * verdade neste projeto foi regra, não renderização. O bug que trancou o reset
 * de senha foi um schema alterado sem a tela acompanhar, e é exatamente o tipo
 * de coisa que um teste de schema pega em milissegundos.
 *
 * `lib/**` só entra aqui quando o módulo não toca em rede nem em `next/*` —
 * Server Actions e queries precisariam de banco e viram teste de integração,
 * que é outro escopo.
 */
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // O build de produção não deve enxergar os testes.
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(raizDoProjeto, '.'),
    },
  },
})

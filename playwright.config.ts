import { defineConfig } from '@playwright/test'

// `BASE_URL` recebe a URL do preview no CI (gerada pelo passo `vercel
// deploy` antes de promover pra produção). Sem ela, testa contra o `npm run
// dev` local, mesmo padrão de variável que o resto do projeto usa
// (`node --env-file=.env.local`), só que aqui é o Playwright que a lê.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
})

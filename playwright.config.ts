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
  projects: [
    {
      // O que o CI roda antes de promover deploy. Só rota pública, sem
      // sessão, sem criar nada.
      name: 'security',
      testMatch: /security-audit\.spec\.ts/,
    },
    {
      // O funil inteiro. Fica FORA do CI de propósito: cria conta real e
      // cobrança real de R$49 no Asaas de produção (ninguém paga, o teste
      // cancela no fim). Rodar isso a cada push encheria o Asaas de cliente
      // e cobrança de teste. Chamado à mão por `npm run test:funil`.
      name: 'funil',
      testMatch: /funil-completo\.spec\.ts/,
      // Um worker só: os passos dependem uns dos outros e compartilham a
      // mesma conta descartável.
      fullyParallel: false,
      // Retry aqui seria pior que a falha: cada tentativa cria outro cliente
      // e outra cobrança no Asaas.
      retries: 0,
    },
    {
      // O produto por dentro: recuperação de senha, importação de planilha,
      // convite e papéis, calendário e o portão do OAuth do Google. Cinco
      // áreas que existiam sem nenhuma prova ponta a ponta.
      //
      // Separado do `funil` porque **não toca em dinheiro**: nenhuma chamada
      // ao Asaas, nenhuma cobrança. O que cria é uma empresa descartável no
      // Supabase, apagada no `afterAll`. É o que torna seguro rodá-lo com
      // frequência, ao contrário do `funil`.
      //
      // Fora do CI mesmo assim, por um motivo diferente: ele escreve no banco
      // de PRODUÇÃO (é o único que existe), e o gate roda a cada push. Uma
      // falha de rede no meio deixaria empresa órfã sem ninguém olhando.
      // Chamado à mão por `npm run test:produto`.
      name: 'produto',
      testMatch: /produto-logado\.spec\.ts/,
      // Os 30s padrão não cabem aqui: cada teste faz login de verdade e
      // atravessa telas que consultam o banco em São Paulo, e contra `npm run
      // dev` ainda paga a compilação da rota na primeira visita. Medido, o
      // teste da planilha sozinho passa de 30s só entre entrar e abrir
      // `/leads`.
      timeout: 120_000,
      // Serial pelo mesmo motivo do funil: os cinco compartilham uma empresa.
      fullyParallel: false,
      // Retry recriaria a empresa e reenviaria convite; a falha é mais barata.
      retries: 0,
    },
  ],
})

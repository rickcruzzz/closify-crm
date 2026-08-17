# Teste de carga, Velo Funil

Plano completo em `C:\Users\orlan\.claude\plans\sequential-foraging-creek.md`
(fora do repo, é o plan file da sessão que gerou isto). Achados da auditoria
que motivaram os cenários priorizados estão documentados nos comentários de
cada script `c*`/`race*` abaixo, e resumidos em `docs/load-test/plano-de-teste.md`.

Nada aqui toca produção. Tudo aponta para um projeto Supabase novo
(`.env.staging`, nunca commitado) e para a app rodando localmente via
`next build && next start`.

## Passo 0, só o dono consegue fazer isto

1. Criar projeto novo em supabase.com/dashboard → tier **Free**, região igual
   à de produção, nome sugerido `velofunil-staging`.
2. Settings → API: copiar Project URL, publishable key, secret key.
3. Colar em `scripts/load-test/.env.staging` (criar a partir do exemplo
   abaixo, já cai no `.gitignore` do projeto via `.env*`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   # Opcional, só se quiser aplicar migrations via CLI em vez de colar no
   # SQL Editor:
   SUPABASE_ACCESS_TOKEN=
   SUPABASE_PROJECT_REF=
   ```

4. Aplicar as 24 migrations de `supabase/migrations/*.sql`, em ordem, no
   SQL Editor do projeto staging (ou `npx supabase db push` se preencheu o
   token/ref acima).

## Ordem de execução

```bash
# 1. seed pequeno pra validar a lógica antes da escala completa
node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/seed.mjs --scale=small

# 2. seed completo (~850 workspaces, ~1000 usuários), demora, mostra progresso
node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/seed.mjs --scale=full

# 3. instalar k6 (Windows, sem admin)
winget install k6 --source winget

# 4. build de produção local apontando pro staging
cp scripts/load-test/.env.staging .env.local.loadtest   # não precisa, next lê .env.local
# mais simples: rode com --env-file do Node não se aplica ao `next start`.
# Em vez disso, copie manualmente os 4 valores de .env.staging para .env.local
# ANTES de buildar, e restaure .env.local depois, ou rode num checkout separado.
npm run build && npm run start

# 5. stub do Asaas (outro terminal), só é usado pelo cenário c8
node scripts/load-test/asaas-stub/server.mjs

# 6. mintar tokens/cookies reais de sessão (outro terminal)
node --env-file=scripts/load-test/.env.staging scripts/load-test/auth/mint-tokens.mjs

# 7. validar o formato do cookie ANTES de qualquer carga
node --env-file=scripts/load-test/.env.staging scripts/load-test/auth/probe-cookie-format.mjs

# 8. suíte k6, na ordem de prioridade (ver docs/load-test/plano-de-teste.md)
pwsh scripts/load-test/k6/run-all.ps1

# 9. checagem de corretude pós-corrida
node --env-file=scripts/load-test/.env.staging scripts/load-test/verify/post-race-checks.mjs

# 10. relatório final
node scripts/load-test/report/build-report.mjs

# 11. limpeza, apaga tudo que o seed criou (ou apague o projeto staging inteiro)
node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/cleanup.mjs
```

## Por que a app precisa rodar localmente (não Vercel real)

`next start` local é o build de produção real (minificado, sem JIT por
rota), então mede o custo do código, só não inclui cold start serverless
nem rede real Vercel↔Supabase. Isso é uma limitação conhecida, declarada no
relatório final, não escondida.

## Por que autenticação usa 3 trilhas em vez de tentar reproduzir o clique do mouse

- **Trilha A** (`a1_*`): páginas públicas, sem sessão.
- **Trilha B** (`b1_*`–`b4_*`): cookie de sessão real
  (`sb-<ref>-auth-token[.N]`), construído em `auth/mint-tokens.mjs` a partir
  de um login de verdade contra o GoTrue REST do staging, mede o custo real
  do middleware/`auth.getUser()` batendo em páginas protegidas.
- **Trilha C** (`c*`/`race*`): PostgREST/RPC direto com JWT de usuário real
  semeado. As Server Actions do Next usam um header `Next-Action` cujo valor
  é hash de build, reproduzir isso é frágil e não muda se uma race
  condition acontece ou não (isso é decidido inteiramente no Postgres). Por
  isso os riscos de banco/RLS/concorrência são testados direto na camada
  onde o bug realmente vive.

Não existe Trilha D (rotas de API espelhando Server Actions), decisão
tomada com o dono: A+B+C já cobre os riscos reais, sem adicionar código em
`app/`.

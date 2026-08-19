/**
 * Lê a resposta salva de `POST /v13/deployments` e publica `preview_url` e
 * `dpl_id` no `$GITHUB_OUTPUT` do passo do workflow.
 *
 * Existe como arquivo próprio, e não como `node -e "..."` inline dentro do
 * YAML, porque a primeira tentativa embutida quebrou: um `run: |` de bash
 * com um heredoc de JS multi-linha dentro de um `$(...)` de substituição de
 * comando é terreno fértil pra bash fechar parêntese no lugar errado — foi
 * exatamente o que aconteceu (`unexpected EOF while looking for matching
 * ')'`), sem nenhum erro de lógica na parte JS em si. Um arquivo `.mjs`
 * testável com `node scripts/ci/publicar-saida-do-deploy.mjs <args>` local
 * evita a categoria inteira desse problema.
 *
 * Uso: node publicar-saida-do-deploy.mjs <caminho-do-json> <caminho-do-github-output>
 */
import { readFileSync, appendFileSync } from 'node:fs'

const [, , caminhoJson, caminhoGithubOutput] = process.argv

if (!caminhoJson || !caminhoGithubOutput) {
  console.error('uso: publicar-saida-do-deploy.mjs <deployment.json> <$GITHUB_OUTPUT>')
  process.exit(2)
}

const resposta = JSON.parse(readFileSync(caminhoJson, 'utf-8'))

if (resposta.error) {
  console.error(JSON.stringify(resposta.error))
  process.exit(1)
}

appendFileSync(caminhoGithubOutput, `preview_url=https://${resposta.url}\n`)
appendFileSync(caminhoGithubOutput, `dpl_id=${resposta.id}\n`)

# Velo Funil

CRM SaaS multi-empresa para PMEs de serviço no Brasil (agências, consultorias,
clínicas, imobiliárias pequenas, software houses), com pipeline de vendas
visual em Kanban, feito para substituir a planilha em um dia. PRD completo em
[docs/prd.md](docs/prd.md). Diagrama de classes do schema (tabelas, chaves,
enums, gerado por inspeção real do catálogo Postgres, não suposto) em
[docs/schema.md](docs/schema.md). Estado real da esteira de testes (o que
roda, o que é manual, o que falta pro CI existir de verdade) em
[docs/testes.md](docs/testes.md).

**O produto está em produção** em <https://www.velofunil.com.br>, com auth,
Kanban, leads, dashboard, multi-empresa, billing pelo Asaas e e-mails
transacionais funcionando. Não é greenfield, não recrie nada do zero.

O estado atual do projeto, o que está pendente, as decisões que não devem ser
refeitas e as armadilhas já pagas, vem importado logo abaixo. É `@` e não link
markdown de propósito: o `@` embute o conteúdo do arquivo neste, e link
dependeria de alguém decidir abrir.

@docs/estado-atual.md

Depois disso, `git log` conta o resto: as mensagens de commit registram o
porquê de cada decisão e são a memória real daqui.

## Stack Técnica

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS, shadcn/ui
- **Kanban/gráficos:** `@dnd-kit` (drag-and-drop), Recharts (funil e métricas)
- **Backend:** Next.js API Routes + Server Actions, runtime Node.js
- **Dados/Auth:** Supabase (PostgreSQL + RLS + Auth + Storage)
- **E-mail:** Resend (recuperação de senha, convites, onboarding, notificações)
- **Pagamento:** Asaas, clientes, assinaturas recorrentes, webhooks, Pix/boleto/cartão
- **Deploy:** Vercel
- **Analytics:** Vercel Analytics. **PostHog não está instalado**, esta linha
  já afirmou os dois, conferido no `package.json` em 12/08/2026. Não existe
  nada medindo ativação: quantos que criam conta chegam ao primeiro lead é uma
  pergunta que hoje ninguém responde
- **Automação futura:** n8n, Notion API, Linear API

> **Importante:** este projeto usa **Asaas**, não Stripe, para pagamentos.
> O agente `payment-integration` (genérico de Stripe/PayPal/Square, sem uma
> linha de Asaas) foi **removido em 30/08**, e a skill `stripe-integration`
> que este aviso citava **nunca existiu no repositório** — a menção era falsa
> desde que foi escrita. Sobra o MCP do Stripe, que é configuração da máquina
> (`~/.claude.json`), fica fora daqui e não é usado.
>
> O aviso permanece porque o risco que ele evita é real: Stripe é o padrão de
> mercado, e o reflexo de qualquer ferramenta ao ver "billing" é sugerir
> Stripe. Aqui é Asaas, com Pix e boleto — que é justamente o que o Stripe não
> resolve bem no Brasil.

## Estrutura de Pastas

Estrutura em uso, organizada por domínio (já implementada, não é proposta):

```
app/
  (auth)/              # login, cadastro, recuperação de senha, boas-vindas
  (dashboard)/
    kanban/            # pipeline de vendas
    leads/             # listagem, busca, detalhe/timeline
    dashboard/         # métricas e gráfico de funil
    settings/          # workspace, colaboradores, permissões, billing
  api/
    webhooks/asaas/    # ativação de plano via webhook
components/
  ui/                  # shadcn/ui (não editar diretamente, apenas via CLI)
  kanban/
  leads/
  dashboard/
lib/
  supabase/            # client, server, middleware
  asaas/
  resend/
hooks/
types/
supabase/
  migrations/
docs/
  prd.md
```

Convenções:

- Mutações passam por **Server Actions**; API Routes só para webhooks/integrações externas.
- Isolamento multi-tenant via **RLS no Supabase**, sempre por `workspace_id`/`company_id`.
- Componentes shadcn/ui vivem em `components/ui` e são gerados via CLI, não editados à mão.
- Papéis de usuário: `admin` e `membro`, checados tanto em RLS quanto na UI.

## Identidade Visual

- **Modo escuro como padrão**, com opção de alternar para modo claro.
- Alto contraste, poucos elementos por tela, cards bem definidos, transições sutis.
- Referências: acabamento premium do **Linear**, fluidez de Kanban do **Pipedrive**,
  credibilidade do **HubSpot**, clareza de freemium do **Calendly**, e adaptação
  ao mercado brasileiro de PMEs no estilo **DataCrazy**.
- Posicionamento: _"Simples como planilha, premium como software líder."_

## Processo de Desenvolvimento

Os milestones **auth → kanban → leads → dashboard → multi-empresa/permissões →
billing (Asaas)** estão entregues e em produção. O que resta são integrações,
a próxima é importação de Excel/planilha.

### Verificar contra produção, não supor

O padrão daqui: nada é dado como funcionando sem prova. Script descartável em
Node lendo o ambiente (`node --env-file=.env.local`), exercitando o caminho
real, webhook, API do Supabase, envio de e-mail, e limpando o que criou num
`finally`. Vários defeitos desta base só apareceram assim, e pelo menos dois
alarmes falsos foram descartados pelo mesmo método.

Para regra de permissão e limite de plano, simular sessão real no Postgres
(`set local role authenticated` + `set local request.jwt.claims`) e **tentar a
escrita indevida**. Se passar, a regra não existe.

### Antes de encerrar qualquer mudança

`npx tsc --noEmit`, `npm run lint`, `npm test` e **`npm run build:check`**, os
quatro limpos. Testes cobrem lógica pura em `lib/**` (schemas, parsers,
formatadores); cada caso documenta o defeito que o motivou, e é assim que devem
continuar.

**Use `build:check`, não `build`, com o `npm run dev` de pé.** Os dois escrevem
na mesma pasta `.next` por padrão, e o build sobrescreve o mapa de chunks que o
servidor de desenvolvimento está usando: a partir daí toda rota morre com
`MODULE_NOT_FOUND` em `webpack-runtime.js`, sem nada estar errado no código. O
erro aponta para o arquivo da rota, então parece defeito do que você acabou de
escrever — e derrubou a Central do dono três vezes numa sessão só, sempre pelo
próprio gate. `build:check` escreve em `.next-check`
(`scripts/ci/build-de-conferencia.mjs`); `npm run build` continua indo para
`.next`, que é o que a Vercel espera.

## O mapa do projeto (grafo do graphify)

`graphify-out/graph.json` é um índice navegável de todo este repositório:
**3.743 nós e 8.554 arestas em 288 comunidades** (01/09/2026), ligando arquivo,
função, componente, tabela e conceito de documentação.
Serve para achar coisa rápido, e **é a primeira parada antes de sair lendo
arquivo atrás de arquivo** para perguntas do tipo "quem chama X", "onde isso é
usado", "o que quebra se eu mexer aqui".

```sh
graphify query "onde o limite de contatos do plano Free e aplicado"
graphify path "pro_vigente" "checar_teto_de_mensagens"
graphify explain "textoDaConversao"
```

`GRAPH_REPORT.md` e `graph.html` (abre no navegador, sem servidor) mostram o
mesmo grafo agrupado por domínio: Central do Dono, Conversas do WhatsApp,
Tarefas e próxima ação, e assim por diante.

**Ele se atualiza sozinho.** Um hook de `post-commit` reextrai o código
alterado a cada commit, e um de `post-checkout` faz o mesmo ao trocar de
branch. É AST puro, determinístico, sem LLM e sem custo, e escreve só dentro de
`graphify-out/`, que está no `.gitignore`. Arquivo apagado é podado junto, então
o grafo não acumula referência morta.

Logo depois do rebuild, `scripts/grafo/nomear-comunidades.py` devolve os nomes
de domínio às comunidades. Ele existe porque o graphify renomeia cada uma pelo
nó mais central sempre que o agrupamento muda, e "Central do Dono" virava
`galeria-de-criativos.tsx`. A rotulagem é derivada da pasta dominante, sem LLM
e sem custo, então cabe dentro do hook.

O que o hook **não** cobre: documento e imagem, que exigem leitura semântica.
Depois de mexer em `docs/**` ou trocar um print, rode `/graphify . --update`.
O cache guarda o que já foi extraído, então só o que mudou custa alguma coisa.

**Desde 01/09 existe um `.graphifyignore`,** e ele é a outra metade da regra
de corte abaixo. Ficaram de fora `.claude/skills/` e `.deepsec/` (ferramentas
instaladas, que se atualizam por fora do Git), `graphify-out/` (sem isso cada
rebuild indexa o relatório do anterior) e o binário de marketing — as artes
continuam versionadas, mas um PNG não responde "onde o preço é lido"; os
geradores, que são código, continuam dentro. Medido: 249 dos 3.966 nós vinham
de `.claude/`, e a poda tirou 235 de 53 arquivos.

**A regra de corte, aprendida caro em 27/08:** só entra no grafo o nó cujo
arquivo existe no disco **e mora dentro deste repositório**. O grafo chegou a
ter 17.014 nós, dos quais **13.502 apontavam para outro projeto** — herança de
uma rodada antiga —, e nada na resposta de uma consulta avisava disso. Só
"existe no disco" não basta: 35 nós apontavam para um plugin do Claude Code
instalado na pasta pessoal do usuário, fora daqui. O que foi retirado está
inteiro em `graphify-out/arquivo/`, nada foi descartado.

**Oito nós apontam para nome de PACOTE** (`next`, `jspdf`, `@playwright/test`,
`node:fs/promises`…) e **não são fantasmas**: são dependências declaradas no
`package.json` que o extrator AST representa como nó de import. Elas não
violam a regra, porque não apontam para outro projeto. O custo é cosmético,
três delas viram comunidade de um nó só no relatório.

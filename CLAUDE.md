# Velo Funil

CRM SaaS multi-empresa para PMEs de serviço no Brasil, com pipeline de vendas
visual em Kanban. **O que ele resolve é o orçamento que o cliente não
responde**: ao salvar a validade de um orçamento nasce a tarefa de cobrar o
retorno dois dias antes de vencer.

**O ICP foi MEDIDO em 07/09, não suposto** — 27 nichos, com régua escrita antes
de olhar o resultado (`ORCAMENTO >= 2`, `FORTE >= 4`, `CONTATO >= 6`):

    aprovados   dedetizacao, comunicacao visual, marcenaria,
                locacao de equipamentos, eventos corporativos
    clinica     REPROVOU — zero pedidos de orcamento em dez sites. "Agende sua
                avaliacao" e dor de AGENDA, que este produto nao resolve
    agencia     REPROVOU — 3 sinais fortes e ZERO orcamento: vende por reuniao
                e proposta por e-mail, nao por formulario

Esta linha dizia "agências, consultorias, clínicas, imobiliárias pequenas,
software houses" até 11/09, e `clinica` liderava a régua ANTIGA — pelo motivo
errado: ela lia "precisa de um concorrente meu" como "precisa de mim".

E o posicionamento era *"substituir a planilha em um dia"*, de agosto. Trocado
porque três medições independentes apontaram para o mesmo objeto: 29 de 50
nichos respondem **orçamento** quando procuram software (CRM, 14); 59% dos
concorrentes anunciam proposta; e **nenhum de 25 geradores de orçamento avisa
antes de vencer**.

PRD completo em [docs/prd.md](docs/prd.md). Diagrama de classes do schema (tabelas, chaves,
enums, gerado por inspeção real do catálogo Postgres, não suposto) em
[docs/schema.md](docs/schema.md). Estado real da esteira de testes (o que
roda, o que é manual, o que falta pro CI existir de verdade) em
[docs/testes.md](docs/testes.md).

**O produto está em produção** em <https://www.velofunil.com.br>, com auth,
Kanban, leads, dashboard, multi-empresa, billing pelo Asaas e e-mails
transacionais funcionando. Não é greenfield, não recrie nada do zero.

## Antes de propor construir qualquer coisa: [docs/capacidades.md](docs/capacidades.md)

Índice de uma linha por capacidade, com o arquivo onde ela vive. Responde
**"isso já existe?"** numa leitura, e tem uma seção `O que NÃO existe` para a
outra metade da pergunta.

Ele nasceu de um erro concreto: em 03/09 foi proposto construir um rastreamento
de ativação que existia desde 31/08, com o raciocínio já escrito no comentário
do próprio arquivo. O fato estava no `estado-atual.md` — não perdido, mas entre
250 KB, e não encontrado na hora em que decidia alguma coisa.

Os caminhos citados lá são conferidos por `scripts/ci/conferir-documentos.mjs`,
então o índice não envelhece em silêncio.

## O estado atual, importado

O que está pendente, as decisões que não devem ser refeitas e as armadilhas já
pagas vêm importados logo abaixo. É `@` e não link markdown de propósito: o `@`
embute o conteúdo do arquivo neste, e link dependeria de alguém decidir abrir.

**Ele guarda setembro e o que é perene.** As rodadas de agosto foram para
[docs/historico-agosto.md](docs/historico-agosto.md) em 04/09, inteiras e sem
resumo — o documento tinha chegado a 250 KB e parado de funcionar como memória.
O arquivo é a leitura de quando você precisa do porquê inteiro de uma decisão
de agosto.

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
  já afirmou os dois, conferido no `package.json` em 12/08/2026. **A ativação é
  medida** desde 31/08, sem rastreador de terceiro: `lib/analytics/ativacao.ts`
  dispara o evento do primeiro contato, e `lib/dono/ativacao.ts` monta o funil
  de seis degraus. Esta linha afirmou o contrário até 04/09 — e era o erro que
  fez `docs/capacidades.md` nascer, repetido dentro do arquivo lido no começo
  de toda sessão
- **Automação:** **n8n em produção** desde 10/09, na VPS, com o agente SDR de
  WhatsApp (Evolution API + OpenAI). Hoje **desligado por decisão do dono** —
  que é diferente de inexistente: ele foi construído, auditado 17/17 numa
  bateria adversarial, e ganhou memória, buffer, áudio e imagem em 11/09.
  Notion e Linear nunca entraram e nada os pede; a linha os listava como
  "futuro" desde o começo

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
    hoje/              # o que vence hoje, a tela de abrir de manhã
    kanban/            # pipeline de vendas
    leads/             # listagem, busca, detalhe/timeline
    dashboard/         # métricas e gráfico de funil
    calendario/        # mês, semana e agenda sobre as tarefas
    conversas/         # WhatsApp — hoje em `migrando`, só o link wa.me
    perfil/            # dados da pessoa, senha, exclusão de conta
    settings/          # workspace, colaboradores, permissões, billing
  (conteudo)/          # páginas de SEO escritas para quem não conhece o produto
  (legal)/             # privacidade e termos, exigidos pela LGPD
  (dono)/              # a Central do Dono — 404 fora de localhost, ver abaixo
  convite/[token]/     # aceite de convite, aceita sozinho quando dá
  api/
    webhooks/asaas/    # ativação de plano via webhook
    cron/              # vigia, reconciliação de assinatura, purga
components/
  ui/                  # shadcn/ui (não editar diretamente, apenas via CLI)
  kanban/              # board, card, painel do negócio, boundary do funil
  leads/               # lista, importação, detalhe
  dashboard/
  calendario/          # mês, semana, agenda, chip e painel de leitura
  erros/               # CapturaDeComponente, o único componente de classe
lib/
  supabase/            # client, server, middleware
  asaas/               # checkout, webhook, aplicar-evento
  resend/
  leads/               # csv, planilha, importação — o parser vive aqui
  deals/  tasks/  workspace/  integrations/
  sdr/                 # o agente de WhatsApp: instruções, blindagem, mídia
  analytics/           # ativação e consentimento, sem rastreador de terceiro
  dono/                # só a Central; nada daqui roda no produto do cliente
  emails/  notificacoes/  erros/  validations/
hooks/
types/
supabase/
  migrations/
scripts/
  ci/                  # contagens, conferidor de documentos, build:check
  local/               # ferramentas de operação (estado da Evolution)
  inteligencia/        # prospecção: universo, abordagem, não-perturbe
  marketing/           # geradores de criativo, auditoria de descoberta
docs/
  prd.md
```

**`lib/dono/` e `app/(dono)/` não fazem parte do produto vendido.** São a
Central do Dono, que devolve 404 fora de `localhost` — o gate existe porque ela
lê com `createAdminClient()`, que ignora RLS por completo.

Convenções:

- Mutações passam por **Server Actions**; API Routes só para webhooks/integrações externas.
- Isolamento multi-tenant via **RLS no Supabase**, sempre por `workspace_id`.
  **Não existe `company_id`** — esta linha ofereceu os dois nomes até 11/09, e
  o catálogo não tem nenhuma coluna com esse nome. Quem lesse iria procurar.
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
billing (Asaas)** estão entregues e em produção, e a importação de planilha
saiu em 11/08. **Não há próximo milestone definido**: o que resta está na fila
técnica do `docs/estado-atual.md`.

**O primeiro usuário externo real chegou em 10/09** — antes disso, toda decisão
de prioridade esperava por ele. Ele cadastrou 19 contatos **à mão**, um por
minuto, com a importação de planilha disponível na mesma tela. Zero pagantes
externos continua verdade; o que mudou é que agora existe alguém de fora para
quem o produto confunde ou não.

E foi ele quem produziu o achado de 11/09: se um usuário digita 19 contatos com
o importador ao lado, ou ele não achou o botão — ou tentou e não conseguiu. Era
a segunda.

Esta linha dizia "a próxima é importação de Excel/planilha" até 04/09, apontando
o roadmap do arquivo mais lido do projeto para algo pronto havia um mês, e
dizia "nunca teve cliente externo" até 11/09.

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
quatro limpos.

E o conferidor de documentos **com a credencial**:

```sh
node --env-file=.env.local scripts/ci/conferir-documentos.mjs
```

**Sem `--env-file` ele pula as seis metricas de catalogo e sai com codigo 0.**
Achado em 16/09: `banco.rpcs_do_projeto` estava documentado como 36 e o real era
37 havia uma migration inteira, e o vigia passava limpo. E a mesma classe que ele
existe para fechar, aparecendo por outra porta. Testes cobrem lógica pura em `lib/**` (schemas, parsers,
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

<!-- contagem: grafo.nos>=4000 grafo.arestas>=9000 grafo.comunidades>=300 -->
`graphify-out/graph.json` é um índice navegável de todo este repositório: **mais
de 4000 nós e 9000 arestas, em mais de 300 comunidades**, ligando arquivo,
função, componente, tabela e conceito de documentação.

O número é declarado como **piso, e não como valor exato**, e isso é decisão. O
hook de `post-commit` reconstrói o grafo a cada commit: qualquer arquivo novo
move a contagem, e um número exato aqui estaria errado no commit seguinte —
tornando o alarme ruído diário. O piso só falha quando o grafo **encolhe**, que
é exatamente o acidente que importa: foi assim que 13.502 nós de outro projeto
entraram, e é assim que uma poda mal feita apareceria.
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
Sempre que atualizar o grafo, sinalize isso na resposta e deixe claro se o
Graphify foi só consultado ou se o `graphify-out/` foi reconstruído.
O cache guarda o que já foi extraído, então só o que mudou custa alguma coisa.

**Desde 01/09 existe um `.graphifyignore`,** e ele é a outra metade da regra
de corte abaixo. Ficaram de fora `.claude/skills/`, `.agents/skills/` e
`.deepsec/` (ferramentas instaladas, que se atualizam por fora do Git),
`graphify-out/` (sem isso cada rebuild indexa o relatório do anterior) e o
binário de marketing — as artes continuam versionadas, mas um PNG não responde
"onde o preço é lido"; os geradores, que são código, continuam dentro. Medido
em 01/09: 249 dos 3.966 nós vinham de `.claude/`, e a poda tirou 235 de 53
arquivos.

<!-- contagem: grafo.nos_de_claude=38 -->
**Hoje sobram 38**, em SEIS arquivos de `.claude/agents/`. Eram 28 em cinco até
11/09, quando `.claude/agents/hermes.md` nasceu — o auditor adversarial que
tenta DERRUBAR afirmações em vez de confirmá-las. Ele contribuiu 4 nós de AST e
4 semânticos: os agentes são lidos pelos dois extratores, e é por isso que o
número subiu 10 e não 4.

**Não é regressão**, e a distinção fica escrita porque a leitura errada é fácil:
o `.graphifyignore` corta `.claude/skills/`, e os **agentes** nunca estiveram na
regra. Skill é ferramenta instalada, que se atualiza por fora do Git; agente é
arquivo deste repositório, versionado, que descreve como trabalhar aqui.

**A regra de corte, aprendida caro em 27/08:** só entra no grafo o nó cujo
arquivo existe no disco **e mora dentro deste repositório**. O grafo chegou a
ter 17.014 nós, dos quais **13.502 apontavam para outro projeto** — herança de
uma rodada antiga —, e nada na resposta de uma consulta avisava disso. Só
"existe no disco" não basta: 35 nós apontavam para um plugin do Claude Code
instalado na pasta pessoal do usuário, fora daqui. O que foi retirado está
inteiro em `graphify-out/arquivo/`, nada foi descartado.

<!-- contagem: grafo.nos_sem_arquivo=126 -->
**126 nós não têm arquivo de origem, e nenhum deles é fantasma.** A grande
maioria são objetos do banco que o extrator representa sem arquivo —
`public.workspaces`, `auth.users`, `public.checar_teto_de_mensagens` —, mais
alguns símbolos importados pelos geradores em Python (`FreeTypeFont`, `Image`,
`Path`). Não violam a regra de corte: não apontam para outro projeto, apontam
para lugar nenhum, de propósito.

**O número fica EXATO no carimbo, e não vira piso.** Ele se move a cada
migration que cria objeto — e quando ele anda, o schema e o PRD devem ser
reconsiderados junto. É o oposto da contagem de nós, que é piso porque cresce
todo dia.

Como ele andou, em ordem:

    103   ate 06/09
    105   07/09   as duas tabelas da 0072, hoje removidas
    106   07/09
    107   08/09   `public.deals` — a tabela JA EXISTIA. A 0076 faz `alter`, e
                  referencia de `alter` nao carrega o arquivo que definiu a
                  tabela do jeito que um `create` carrega
    108   09/09   `Image` do Pillow, usado direto quando `icone_de_confirmacao`
                  nasceu — a segunda metade da explicacao acima
    119   11/09   ONZE de uma vez, e todos do mesmo caso do 107: objetos de
                  banco citados por `alter table` em migrations antigas
                  (0069-0075, 0078, 0081, 0082). Um `--update` reextraiu as
                  migrations inteiras, e cada `alter` mintou o objeto sem
                  arquivo. NENHUMA tabela nasceu — a contagem do catalogo
                  continua 21, medida por `banco.tabelas`
    120   12/09   `public_descadastro_de_prospeccao`, mintado pelo `alter
                  table` da 0083. Mesmo caso do 107 e do 119 — a tabela ja
                  existia desde a 0080
    123   12/09   TRES da 0086: `public_prospeccao_prospect` (alter numa
                  tabela que a 0084 tinha CRIADO horas antes) mais
                  `public_conversas` e `public_mensagens`, citadas nas
                  foreign keys. Mesmo caso de novo
    120   15/09   DESCEU tres, e e a primeira queda da serie. A 0087 nao
                  acrescentou objeto nenhum: ela so mexeu em `check` e em
                  coluna de tabela que ja existia. Os tres que sairam sao os
                  do proprio salto acima — o `--update` reextraiu as
                  migrations e os `alter` da 0086 deixaram de mintar nó
                  proprio quando a 0087 passou a ser a ultima a tocar as
                  mesmas tabelas.

                  **Queda e o unico caso que o piso nao pega**, e por isso
                  este numero e EXATO e nao piso: ele desceu sem nada ter
                  sido apagado do repositorio
    122   16/09   DOIS, e sao do mesmo caso de 107, 119 e 120: a 0088 faz
                  `drop function` e `create function` sobre `public.deals`, e
                  referencia de funcao a uma tabela nao carrega o arquivo que
                  definiu a tabela. **Nenhuma tabela nasceu** — a 0088 nao tem
                  um `create table`, so duas RPCs. `banco.tabelas` nao se moveu
    123   16/09   MAIS UM, no mesmo dia e pelo mesmo motivo: o hook de
                  post-commit reextraiu a 0088 depois do commit dela, e a
                  segunda RPC (`get_funnel_performance`) referencia
                  `public.deals` tambem. O carimbo anterior foi medido ANTES
                  do rebuild terminar — e isso e uma armadilha do proprio
                  metodo: carimbar numero de grafo no mesmo commit que mexe em
                  migration mede o grafo de antes
    124   16/09   MAIS UM, e o caso de 107/119/120 pela QUINTA vez: a 0089 faz
                  `alter table public.subscriptions` para acrescentar a coluna
                  `plano`, e referencia de `alter` nao carrega o arquivo que
                  definiu a tabela do jeito que um `create` carrega.

                  **NENHUMA tabela nasceu, e a 0089 nao tem um `create table`**
                  — ela acrescenta uma coluna e uma funcao. A 0090, que CRIA
                  `whatsapp_instances`, ainda nao entrou nesta contagem: ela e
                  do commit seguinte, e quando entrar o no dela vira COM
                  arquivo, porque `create table` carrega a origem
    126   17/09   MAIS UM, e a SEXTA vez do mesmo caso: a 0091 faz
                  `alter table public.whatsapp_instances` para acrescentar
                  `sem_max_desde`, e a tabela foi definida na 0090 — do commit
                  anterior, com arquivo. O `alter` mintou um segundo no sem
                  arquivo.

                  **A serie inteira ate aqui e UM caso so**, repetido em 107,
                  119, 120, 122/123, 125 e agora. Nenhuma tabela nasceu em
                  nenhum deles: `banco.tabelas` e medido a parte, pelo
                  catalogo, e e ele que responde essa pergunta
    125   16/09   MAIS UM, no commit seguinte, e a previsao acima se CONFIRMOU
                  inteira. A 0090 faz `alter table public.mensagens` para
                  abrir o `check` de `status`, e `mensagens` foi definida na
                  0056 — referencia de `alter` nao carrega o arquivo.

                  **E `whatsapp_instances`, que a MESMA migration CRIA, entrou
                  COM arquivo e nao aparece aqui.** As duas coisas no mesmo
                  commit, e so uma move este numero: e a prova de que a serie
                  mede `alter`, nunca nascimento de tabela. Ler o +1 como
                  "nasceu uma tabela" daria a resposta certa por acidente desta
                  vez, e errada na proxima

**A leitura errada aqui é fácil e cara:** ver o número subir logo depois de uma
migration convida a concluir que uma tabela nasceu. Em nenhum dos três últimos
casos nasceu — inclusive no salto de onze em 11/09, que veio de `alter table` e
não de `create`.

**E em 12/09 as duas coisas aconteceram ao mesmo tempo, o que torna a distinção
mais nítida, não menos.** Uma tabela DE FATO nasceu — `prospeccao_prospect`, da
0084 —, e `banco.tabelas` foi de 21 para 22. Mas o **+1** dos nós sem arquivo
não é ela: `create table` carrega o arquivo que o definiu, então
`prospeccao_prospect` entrou no grafo COM origem. Quem entrou sem foi
`descadastro_de_prospeccao`, pelo `alter` da 0083, numa tabela que existe desde
08/09.

Ou seja: as duas contagens se moveram no mesmo commit, por motivos que não têm
relação nenhuma entre si. Ler uma pela outra daria a resposta certa por
acidente desta vez, e errada na próxima.

**E desde 11/09 há como conferir sem adivinhar:** `banco.tabelas` mede o
catálogo de verdade, e é carimbado no `prd.md` e no `schema.md`. O número de nós
sem arquivo e o número de tabelas passaram a ser perguntas separadas, com
respostas separadas.

Estes cinco parágrafos estavam em cinco blocos separados, **fora de ordem
cronológica** (09/09 antes de 08/09), cada um correto quando escrito e o
conjunto ilegível: para saber o valor de hoje era preciso reconstruir a ordem.

**Esta frase dizia "oito nós apontam para nome de PACOTE (`next`, `jspdf`…)"
até 04/09**, e o erro não era o número: era a natureza. Hoje não há um único nó
de pacote. Trocar 8 por 103 mantendo a explicação teria deixado o texto
numericamente certo e semanticamente falso — pior do que estava, porque estava
obviamente velho.

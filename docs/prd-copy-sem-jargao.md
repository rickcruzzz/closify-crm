# PRD: Copy sem jargão + headline no início

Documento focado, no mesmo espírito de [estado-atual.md](estado-atual.md):
problema → decisão → por que não foi outra coisa. Referenciado a partir de
[prd.md](prd.md). Entregue em 16/08/2026.

## 1. Problema

Dono relatou, testando a landing como cliente-alvo (dono de agência,
clínica, consultoria, imobiliária pequena, leigo em CRM/software): a página
usa termos internos do produto que esse público não entende,
**pipeline**, **Kanban**, **leads**, **timeline**, **workspace**, e a sigla
**RLS** exposta como métrica de destaque. Quem não entende o que está lendo
não assina, perda de venda por confusão, não por preço.

Mapeando as 13 seções/componentes da landing, string por string:

- **"pipeline"** aparecia 6 vezes visível ao usuário, inclusive já na
  primeira dobra: o mockup do Hero (`pipeline-preview-card.tsx`) mostrava
  literalmente `"pipeline / workspace: acme-corp"` escrito na tela antes de
  qualquer explicação do que isso significa.
- **"workspace"** aparecia 6 vezes (Features, CTA final, 3x no FAQ, 1
  mockup), inconsistente com a própria seção de Planos, que já dizia
  "empresa" corretamente.
- **"RLS"** era o VALOR de uma estatística em destaque (`stats-section.tsx`),
  sigla de banco de dados sem nenhuma expansão no próprio elemento.
- **"timeline"** e **"taxa de conversão"** apareciam sem explicação em
  descrições de funcionalidade.

Achado à parte, favorável: a melhor linha da landing inteira já existia,
**"Pare de perder venda por esquecimento"**, mas enterrada como H2 da seção
Planos, a 5ª seção da página. Perda concreta, sem jargão nenhum, gatilho de
aversão à perda (a pessoa já perdeu isso, não é hipótese). Provado como
padrão eficaz: consultado `ui-ux-pro-max --domain landing`, o padrão
"Before-After Transformation" (Hero abre pelo estado do problema, não pela
feature) é o que essa linha já fazia, só que 5 seções tarde demais.

## 2. Decisão

Duas frentes, uma só rodada:

**(a) A frase que já funcionava sobe pro Hero.** "Pare de perder venda por
esquecimento" vira o H1, primeira coisa que qualquer visitante lê. A seção
Planos ganha headline nova, sem repetir a mesma linha duas vezes na página.

**(b) Todo jargão de texto corrido é reescrito em português comum**, com uma
exceção deliberada: onde "lead" é o **nome real de uma tela do produto**
(FAQ apontando pra "tela de Leads", que é o nome de verdade no dashboard
depois do cadastro), o termo **fica**. Prometer "tela de Contatos" na
landing e a pessoa cair numa tela chamada "Leads" na primeira sessão depois
de pagar quebraria confiança pior do que o problema original. Renomear a
tela em si (`app/(dashboard)/leads/`, nav, `lib/leads/types.ts`) é decisão
de produto separada, sem relação com copy de marketing, não entrou nesta
rodada.

"Funil", "negócio"/"negócios" e "etapa"/"etapas" ficaram como estão: são
português comum de vendas, o próprio relato não os citou como problema, e
trocar sem necessidade só gera trabalho de revisão sem ganho de clareza.

## 3. O que mudou

| Área | Antes | Depois |
| --- | --- | --- |
| Headline do Hero | "Simples como planilha, premium como software líder." | "Pare de perder venda por esquecimento." |
| Parágrafo do Hero | "Lead esquecido na planilha é venda perdida..." | "Todo cliente que você esquece de responder é um cliente que você perde...", mesma ideia, sem "lead" |
| CTA secundário do Hero | "Ver funcionalidades" → `#funcionalidades` | "Ver como funciona" → `#como-funciona` (manda pro passo-a-passo simples antes da grade densa de 7 itens) |
| Headline da seção Planos | "Pare de perder venda por esquecimento" (repetida do Hero) | "Comece de graça. Pague quando fizer sentido crescer." |
| "Pipeline visual Kanban" (feature + item do plano Free) | Nomeia o padrão técnico | "Funil visual, arrasta e solta", descreve a ação |
| "Gestão de leads" | Nomeia a tela | "Todos os seus contatos num só lugar" |
| "Dashboard de métricas" | Anglicismo | "Painel de resultados" |
| "Multi-empresa" / "workspaces" | Termo técnico | "Várias empresas, um login só" / "empresa" |
| "Permissões por papel" / "Admin e Membro" | Nomeia rótulos de UI | "Controle por colaborador", descreve o efeito |
| "leads" (texto corrido, ~9 ocorrências) | Jargão | "contatos" |
| "timeline completa de atividades" | Jargão | "histórico completo" |
| "taxa de conversão" | Jargão de marketing | "quantos clientes viraram venda" |
| Stat "RLS" | Sigla crua como valor de destaque | "100%" / "dados só da sua empresa, nunca de outra", mesmo fato verificável |
| FAQ sobre isolamento de dados | "Row Level Security", "consulta", "linha" | Linguagem de resultado, sem termo de banco |
| "workspace" (CTA final, FAQ) | Termo técnico | "empresa"/"conta da empresa", já era assim em Planos, agora consistente |
| Mockups (Hero + Como Funciona) | `"pipeline / workspace: acme-corp"`, `"total pipeline"` | `"funil de vendas · Acme Corp"`, `"total no funil"` |
| Nomes de etapa nos mockups ("Novo Lead" etc.) |, | **Sem mudança**, são nome real de coluna no produto |

## 4. Por que não foi diferente

- **Não renomeei "Leads" no produto real.** A tela, o nav do dashboard e
  `lib/leads/types.ts` continuam com o nome de sempre, mudar isso é projeto
  à parte (toca `app/(dashboard)/leads/`, sidebar, testes) e sem relação com
  o problema relatado, que era especificamente sobre a landing pública.
- **Não movi a ordem das seções.** Hero→Stats→Como funciona→Funcionalidades→
  Planos→FAQ→CTA final é decisão documentada em `app/page.tsx` (Como
  Funciona antes de Funcionalidades porque "pipeline visual Kanban" só
  significa algo pra quem já usou CRM; FAQ antes do CTA final por objeção).
  Só o alvo do CTA secundário do Hero mudou, e é o mesmo motivo: manda pro
  passo-a-passo mais simples primeiro.
- **Não inventei estatística nova.** "100%" no lugar de "RLS" é o mesmo fato
  que a sigla já representava (isolamento garantido por linha no banco), a
  regra do próprio `stats-section.tsx` (nada de métrica de resultado sem
  poder provar) continua valendo.
- **Não toquei nos nomes reais dos 6 estágios do funil** ("Novo Lead",
  "Fechado Ganho" etc.) nos mockups visuais, são o que a pessoa vai
  encontrar de verdade depois de criar conta; mudar aí seria mockup mentindo
  sobre o produto.

## 5. O que fica pra depois

Renomear a tela "Leads" do produto autenticado pra algo mais plano
("Contatos"?) é decisão de produto maior, toca nav, rotas, testes, e
provavelmente outros pontos do dashboard que ainda não foram mapeados.
Vale revisitar com dado real de onboarding (onde usuário novo trava ao
navegar), não só pela landing.

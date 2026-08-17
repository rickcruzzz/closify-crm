# PRD: Conversão para o Pro

Documento focado, no mesmo espírito de [estado-atual.md](estado-atual.md):
problema → decisão → por que não foi outra coisa. Referenciado a partir de
[prd.md](prd.md). Entregue em 13/08/2026.

## 1. Problema

Zero cliente pagante até 13/08/2026 (conferido na API do Asaas, ver
[estado-atual.md](estado-atual.md)). Três causas concretas, achadas
investigando o código, não supostas:

1. **A landing vendia feature, não resultado.** "Planos para cada fase do seu
   negócio" não diz o que a pessoa perde continuando na planilha, nem por que
   R$49 é barato perto disso.
2. **O Free liberava tudo.** As três integrações mais caras de construir desta
   base, Google Calendar, Gmail, WhatsApp Cloud API, entregues em 12/08,
   não tinham NENHUMA checagem de plano em `lib/integrations/*`. Dava pra
   rodar o produto inteiro de graça pra sempre.
3. **O redirect automático pro checkout estava morto.** `?plano=pro` na
   landing gravava a intenção num cookie (`lib/auth/intencao.ts`), mas a
   função que deveria lê-la depois de criar a empresa e mandar direto pro
   pagamento (`createWorkspace`, `lib/supabase/actions.ts`) tinha virado
   código órfão numa refatoração anterior, o assistente de 4 perguntas que
   substituiu a tela antiga (`finalizarOnboarding`,
   `lib/onboarding/actions.ts`) nunca herdou essa lógica. Quem clicava
   "Assinar Pro" terminava no Dashboard em Free, sem saber que precisava ir
   em Configurações → Cobrança sozinho. Bug real, achado nesta rodada,
   corrigido no caminho que de fato roda hoje.

## 2. Decisão

**Não** apertar o Free só cortando número, o único cliente real que já usa
o produto (Fani Mayara, Free, 1 lead) está longe de qualquer teto, e a
própria landing já vende "grátis pra sempre" como diferencial
(`StatsSection`). Cortar limite sem dar nada novo em troca é bait-and-switch.

Em vez disso: **as integrações (Google Calendar, Gmail, WhatsApp Cloud API)
passam a exigir Pro.** É o padrão comum de SaaS, núcleo grátis, automação
paga, e transforma o investimento de 12/08 em munição de venda em vez de
custo enterrado. O link simples `wa.me` continua livre no Free: não depende
de token nem de plano, é o atalho sem fricção que já era o propósito dele.

Complementar: teto de leads do Free cai de 50 para 25, ainda dá pra sentir
o produto por semanas de uso real, mas fecha mais cedo. Colaboradores (2) e
empresas (1) ficam como estão, já são o piso; apertar mais penaliza o caso
mais comum de PME (dono + 1 funcionário).

## 3. O que mudou

| Área | Antes | Depois |
| --- | --- | --- |
| Leads no Free | 50 | 25 (`lib/plans.ts`, migration 0037) |
| Integrações (Calendar/Gmail/WhatsApp) | Livres em qualquer plano | Exigem `pro_vigente()`, checado na policy de `integration_connections` (RLS, migration 0037) e nas Server Actions/rotas antes de chamar o provedor externo, pra dar mensagem clara em vez de erro genérico |
| Copy da seção Planos | Feature-first, headline neutra | Resultado-first: "Pare de perder venda por esquecimento", card Pro fala do custo de perder um cliente, benefício lista as integrações exclusivas |
| Preço na landing | Só aparecia na seção `#planos`, 5ª da página | Linha de ancoragem ("A partir de R$0, Pro por R$49/mês...") logo abaixo dos botões do Hero, sem mover a ordem documentada das seções |
| Checkout pós-decisão | 4 perguntas do onboarding antes de ver a tela de cobrança, redirect quebrado | 1 campo (nome da empresa) pra quem veio com `?plano=pro`, redirect pro checkout corrigido e funcionando |

## 4. Por que não foi diferente

- **Não movi a seção de Planos inteira pro topo.** A ordem
  Hero→Stats→Como funciona→Funcionalidades→Planos é decisão documentada
  (comentário em `app/page.tsx`): quem usa planilha precisa ver o fluxo
  antes da lista de recursos. "Valor mais em cima" foi resolvido com uma
  linha de preço no Hero, não com reestruturação.
- **Não toquei no e-mail de pagamento aprovado.** Já existe
  (`lib/emails/pagamento-confirmado.ts`) e já funciona, disparado pelo
  webhook do Asaas.
- **Não toquei na confirmação de e-mail em 2 cliques.** Proteção deliberada
  contra scanner/antivírus consumindo o token antes do clique real,
  armadilha já paga, documentada em `docs/estado-atual.md`.
- **Não tentei redirect automático pro Asaas.** `callback.successUrl` foi
  testado e está quebrado do lado deles (documentado); a abertura de aba já
  é o contorno que funciona.
- **Gate de integração é RLS, não só Server Action.** Lição já paga nesta
  base (0019/0023/0024): regra que só vive na Server Action não é regra,
  porque quem chama o PostgREST direto contorna. A policy de
  `integration_connections` é o que barra de verdade.

## 5. O que fica pra depois

Corte de leads e gate de integração são decisões sem dado de uso real por
trás (zero cliente pagante), revisitar os números quando houver cliente de
verdade batendo nos tetos, em vez de ajustar de novo no escuro.

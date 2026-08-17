# Estado atual do Velo Funil

Documento de continuidade. É lido no começo de toda sessão (referenciado no
[CLAUDE.md](../CLAUDE.md)) para que uma conversa nova, ou outra conta, comece
sabendo o que já foi feito, o que foi decidido e onde estão as armadilhas.

**Atualizado em:** 13/08/2026 (primeiro Pix real recebido e reconciliado, job de reconciliação automática)

> Mantenha este arquivo curto. O detalhe de _por que_ cada coisa é assim mora
> nas mensagens de commit e nos comentários do código, que são a memória real
> do projeto. Aqui fica só o que não cabe em nenhum dos dois: o estado.

## Onde o produto está

Em produção em <https://www.velofunil.com.br>, funcional, com o **primeiro
Pix real confirmado** (workspace "Orne", R$49, 13/08). O fluxo de dinheiro foi
auditado ponta a ponta e funciona: pagamento confirmado libera o Pro, retry do
Asaas é deduplicado, cancelamento rebaixa, requisição sem token toma 401.

Esse mesmo pagamento expôs um buraco real: o webhook do Asaas não chegou a
tempo (o domínio estava fora do ar por causa da migração de DNS pro
Cloudflare, ver seção própria abaixo) e o Asaas **não reenvia webhook que
falhou por conta própria**, o pagamento ficaria preso pra sempre até alguém
notar. Corrigido em duas partes: (1) reenviei o webhook real pra produção,
aplicando o efeito completo (status, e-mail, evento Meta) exatamente como o
Asaas teria feito; (2) criei `GET /api/cron/reconciliar-assinaturas`
(`vercel.json`, roda 1x/dia via Vercel Cron, protegida por `CRON_SECRET`),
que varre assinaturas com status suspeito no banco, confere o status real via
API do Asaas e corrige sozinha, rede de segurança pra qualquer falha futura
de entrega de webhook, não só DNS. A lógica de aplicar o status (dedupe, RPC,
e-mail, Meta) foi extraída pra `lib/asaas/aplicar-evento.ts` e é reusada pelos
dois caminhos (webhook e cron), pra não divergir. Testado ponta a ponta com
assinatura descartável real no Asaas (`receiveInCash`, sem cobrança de
verdade): detectou divergência, corrigiu, gravou dedupe, e uma segunda
chamada não reprocessou.

Importação de planilha (`.xlsx` e `.csv`) entregue em 11/08, com mapeamento de
coluna, etapa lida do arquivo e criação de negócio junto do lead.

O Pro passou a ter prazo (0027): pagou, vale 30 dias; venceu, o limite do Free
volta a valer. Sem `pg_cron` de propósito, a validade é uma função consultada
por quem aplica limite, então plano vencido para de valer no instante em que
alguém tenta usá-lo.

Fluxo de entrada refeito em 11/08: convite deixa de virar conta separada,
confirmação de e-mail termina numa tela com botão, `/verifique-email` reenvia,
e quem clica em "Assinar Pro" na landing chega ao checkout.

**Tarefas e próxima ação entregues em 12/08** (migration 0029). Tela `/hoje`,
próxima ação no card do Kanban no lugar do prazo, bloco de tarefas na página do
lead, agendar/concluir no painel do negócio, e botão de WhatsApp por link
`wa.me`. Zero credencial nova e zero dependência nova, nada disso depende de
serviço externo.

**Onboarding entregue em 12/08** (migrations 0030 e 0031). Boas-vindas para
quem chega, assistente de 4 perguntas que retoma de onde parou, dados da
empresa em 18 campos com logo no Storage, tour de 5 passos e checklist de
ativação derivado do estado real. Também sem credencial nova.

**Escala e negócio parado, 12/08** (0032 e 0033). O teto de 1.000 linhas do
PostgREST fazia o funil, o Kanban e o seletor de leads mentirem em silêncio,
corrigido com contagem no banco e teto por etapa. E `deals` ganhou
`stage_changed_at`, que só anda quando a ETAPA muda: é a base do filtro
"Parados" no board.

**Performance e banco em São Paulo, 12/08.** Investigação mostrou três causas
distintas para "às vezes precisa clicar duas vezes" e "algumas telas
demoram": `mobile-sidebar.tsx` era o único `Sheet` do projeto sem
`SheetTrigger` (o botão, fora do portal, brigava com o "clicar fora fecha" e
piscava); `workspace-switcher.tsx` parava o spinner antes do `router.refresh()`
aplicar os dados novos (agora usa `useTransition`); e o banco estava em Ohio
(`us-east-2`) enquanto a Vercel roda em São Paulo, **196ms por consulta**,
medido, vezes 8-10 consultas por navegação. Corrigido: consulta de onboarding
saiu do middleware (ida em série) e foi para o layout (`Promise.all`);
`sincronizar_plano_do_workspace` (que era ESCRITA a cada navegação) saiu do
caminho quente e roda só em `/settings`; layout e `resolverWorkspaceAtivo`
passaram a compartilhar UMA consulta a `workspace_members` em vez de duas.

**Migração para `sa-east-1` em andamento**, projeto novo criado
(`tmyeunithjqkbwvezyyn`), as 33 migrations reaplicadas (0002 e 0016 puladas de
propósito: seed de teste e limpeza que não fazem sentido em projeto limpo),
RLS conferida ligada nas 11 tabelas, e os dados copiados com contagem batendo
100% nos dois bancos (15 contas, 10 workspaces, 12 membros, 10 leads, 16
negócios, 5 atividades, 5 assinaturas, 4 convites, 4 tarefas, 15 onboarding).
Quatro provas de RLS/regra de negócio passaram (isolamento entre empresas,
autoupgrade de plano, onboarding de terceiro, autoconvite, todas bloqueadas).

**Uma coisa ficou pendente**, por bloqueio do classificador de segurança do
Claude Code ao tentar ler `auth.users` em lote (senha + token juntos, mesmo
linha a linha): os hashes de senha das 15 contas **não** foram copiados, as
contas existem no projeto novo com o mesmo `id`/e-mail, mas sem senha, então
todo mundo precisa de "esqueci minha senha" no domínio novo antes do cutover.
O arquivo real do bucket `logos` (a logo do workspace "HYJKYKKL") **foi**
copiado, baixado do projeto antigo e reenviado ao novo por `fetch` direto com
a `service_role key` de cada lado, conferido com o mesmo tamanho (258.596
bytes) nos dois. Ver `Pendente do dono` abaixo para o que falta para o corte
final.

**Integrações oficiais entregues em 12/08** (migration 0034): Google Calendar
e Gmail, conectáveis em **Configurações → Integrações**. Ver seção própria
abaixo, grande o suficiente para não caber neste resumo. (A mesma migration
também trouxe WhatsApp Business Cloud API, removida em 13/08, decisão de
produto de não usar; ver seção própria.)

Ambiente local: rode `node --env-file=.env.local scripts/verificar-ambiente.mjs`.
Ele confere as 9 conexões e diz o que falta.

**Lag de navegação investigado e corrigido em 12/08.** Sintoma relatado:
atraso entre clicar num item do menu (Leads, Configurações, Dashboard...) e a
tela mudar, às vezes exigindo dois cliques. Causa raiz, achada lendo código
(não suposta): `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding`, as
duas rodam em paralelo no `app/(dashboard)/layout.tsx` a cada navegação,
cada uma tinha sua PRÓPRIA chamada a `supabase.auth.getUser()`, cada uma no
seu `cache()` do React. `cache()` deduplica chamadas repetidas à MESMA
função, não duas funções diferentes fazendo a mesma coisa, então toda
navegação pagava 2 idas redundantes ao Supabase Auth, além da do middleware.
As duas passaram a compartilhar uma única função cacheada
(`lib/supabase/usuario-autenticado.ts`). Complementar: como o layout do
dashboard faz `await` de tudo isso ANTES de renderizar, sem `<Suspense>`,
nenhum `loading.tsx` de rota aparecia enquanto essa cadeia rodava, zero
sinal entre o clique e qualquer pixel novo, o que faz a pessoa clicar de novo
achando que não funcionou. `components/layout/navigation-progress.tsx`
resolve isso: liga no clique real (delegação de evento em `document`,
qualquer `<a>` interno), desliga quando a rota muda de verdade, não é
temporizador fingindo progresso.

## Integrações, Google Calendar, Gmail (12/08)

Pedido: reduzir o "esqueci de responder" ligando o funil a canais reais,
sem virar CRM inchado. Uma tabela pros provedores (`integration_connections`,
migration `0034`, desenhada pra três, Google Calendar, Gmail e WhatsApp,
mas hoje só dois em uso, ver abaixo), token cifrado (AES-256-GCM,
`lib/integrations/crypto.ts`), `state` do OAuth assinado por HMAC contra CSRF
(`lib/integrations/state.ts`).

**Encontrado e corrigido durante a auditoria**: `revoke select (coluna) ...
from authenticated` **sozinho não bloqueia nada**, testado contra o banco
real, o Supabase já concede `select` na tabela inteira por default privilege
(mesma armadilha que a 0013 documentou para `EXECUTE` de função). A correção
que funciona é revogar `select` da TABELA INTEIRA e conceder de volta só nas
colunas seguras, só assim `access_token_enc`/`refresh_token_enc` ficam
inacessíveis mesmo para o próprio admin da empresa lendo pela API pública.
Provado com sessão real: token não decifrável por `authenticated`, membro sem
admin vê status mas não desconecta, empresa B não enxerga linha de empresa A.

**Google Calendar e Gmail**: OAuth próprio (`/api/integrations/google/*`),
separado do OAuth de login, aquele não persiste refresh token utilizável em
background. Um escopo por conexão (`calendar.events` ou `gmail.send`, nunca
os dois), renovação automática de access_token perto de expirar. Workflow:
botão "Adicionar ao Google Calendar" na próxima ação do negócio (Kanban),
"Enviar e-mail" no painel do lead, os dois registram atividade na timeline.

**WhatsApp Cloud API removida em 13/08**, decisão de produto, não vamos
usar. Existia (Embedded Signup da Meta, webhook em `/api/webhooks/whatsapp`,
mensagem por modelo aprovado, tarefa automática "Responder no WhatsApp")
desde a 12/08, mas nunca teve nenhuma conexão real em produção (conferido
antes de remover: zero linha em `integration_connections` com
`provider = 'whatsapp'`). Removido código, rota de webhook, tabela de dedupe
(`whatsapp_webhook_events`, migration `0043`) e as variáveis `META_APP_ID`/
`META_APP_SECRET`/`META_WHATSAPP_CONFIG_ID`/`META_WEBHOOK_VERIFY_TOKEN`/
`NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID`. O valor
`'whatsapp'` continua existindo no enum `integration_provider` do banco,
Postgres não tem `ALTER TYPE ... DROP VALUE`, e recriar o enum pra tirar um
valor que nenhum código mais insere não valia a complexidade.

O link `wa.me` **continua existindo**, é um mecanismo totalmente separado,
sem token/OAuth nenhum (`lib/leads/whatsapp.ts`, botão "Chamar no WhatsApp"
no painel do lead, link de suporte no rodapé). Não fazia parte da remoção.

**Pendências de configuração manual** (mesmo padrão do Asaas/Resend, eu não
tenho acesso a nenhum destes painéis):

1. **Google Cloud Console**: no projeto OAuth já usado para o login, adicionar
   o redirect URI `https://www.velofunil.com.br/api/integrations/google/callback`
   e ativar a Calendar API + Gmail API. Copiar Client ID/Secret para
   `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`.
2. Gerar `INTEGRATIONS_ENCRYPTION_KEY` (32 bytes hex, `openssl rand -hex 32`)
   e colar local + Vercel.

Sem essas variáveis, os cards de integração aparecem normalmente em
"Não conectado", nada quebra, só o botão "Conectar" falha ao tentar.

## Pendente do dono (não é código)

- [ ] **`CRON_SECRET` na Vercel (13/08).** Gerado e colado no `.env.local`,
      mas falta colar o mesmo valor nas env vars da Vercel (Production),
      sem isso, o Vercel Cron chama `/api/cron/reconciliar-assinaturas` e
      toma 401 todo dia, silenciosamente (a rota não avisa ninguém, só
      responde o erro). Ver `.env.example` pra onde gerar.
- [ ] **`NEXT_PUBLIC_META_PIXEL_ID` na Vercel (13/08).** Meta Pixel ligado
      (`components/analytics/meta-pixel.tsx`, só em páginas públicas,
      landing/cadastro/login/termos/privacidade, nunca no CRM logado) pra
      viabilizar tráfego pago. Funciona local (`.env.local`), mas
      `NEXT_PUBLIC_*` é inlined no BUILD, sem colar o mesmo valor
      (`1566349361566072`) nas env vars da Vercel e rodar um novo deploy, o
      pixel não aparece em produção. **Risco de compliance em aberto,
      registrado, não escondido**: é rastreamento de terceiro (cookie
      `_fbp`) sob a LGPD, mesma razão pela qual o GA4 foi descartado do
      projeto, hoje não existe banner de consentimento de cookies no
      site. Ligado por pedido explícito.
- [ ] **Auditoria de prontidão pra tráfego pago (13/08).** Verificado
      contra o banco de produção: 10 workspaces, zero em `plan = 'pro'`,
      nenhum pagamento (Pix, boleto ou cartão) jamais completou o ciclo
      inteiro até `active`. `Fani RRH Consultoria` está `past_due` desde
      04/08, nunca resolvido. **Recomendação: pagar um Pix real de R$49
      pelo checkout de produção ANTES de gastar em anúncio**, mandar
      tráfego pago pra um checkout nunca provado arrisca queimar o
      anúncio e a venda junto. E-mail de cobrança falhou (`past_due`) foi
      construído nesta sessão (`lib/emails/pagamento-atrasado.ts`),
      ajudará a recuperar cartão recusado no futuro, mas não resolve o
      caso da Fani, que já está parada há dias e pode merecer contato
      direto.
- [ ] **Gate de segurança no deploy (13/08).** `tests/e2e/security-audit.spec.ts`
      e `.github/workflows/deploy-com-auditoria.yml` foram criados, o
      workflow builda, roda a auditoria (chave vazada, headers de
      segurança, stack trace em erro de API) contra um deployment de
      PREVIEW, e só promove pra produção se passar. **O workflow existe só
      no disco, não no repositório**: o token OAuth usado aqui não tem o
      escopo `workflow` do GitHub, e o push do arquivo foi recusado
      ("refusing to allow an OAuth App to create or update workflow...
      without workflow scope"). Faltam três passos manuais pra isso valer
      de verdade:
      1. Adicionar `.github/workflows/deploy-com-auditoria.yml` ao
         repositório, pelo painel do GitHub (Add file → upload, colando o
         conteúdo que já existe no disco) ou com `git push` de uma máquina
         cujo token/PAT tenha o escopo `workflow`.
      2. Gerar `VERCEL_TOKEN` (Vercel → Settings → Tokens) e pegar
         `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (`vercel link` local mostra os
         dois), colar como Secrets do repositório no GitHub.
      3. **Desligar o deploy automático nativo da Vercel pra `main`**
         (Project Settings → Git), sem isso, a Vercel continua deployando
         em paralelo ao Actions, e o gate não impede nada.
      Até isso ser feito, o workflow existe mas não está protegendo nada:
      a Vercel ainda promove sozinha a cada push.
- [ ] **CSP em Report-Only, nunca virou bloqueio.** Medido em 13/08 contra
      produção: 1 violação por página (um `eval` num chunk de dependência,
      zod/@base-ui/lucide, padrão de polyfill). Antes de trocar o header
      pra `Content-Security-Policy` (modo bloqueio de verdade, em
      `next.config.mjs`) falta decidir entre aceitar `'unsafe-eval'`
      (enfraquece bastante a diretiva) ou isolar qual dependência causa
      isso. Sem isso, um XSS futuro (nenhum encontrado até agora) não
      teria barreira nenhuma, e o cookie de sessão do Supabase é legível
      via `document.cookie` por design do próprio `@supabase/ssr`, então a
      CSP é a única defesa que falta pra fechar essa combinação.
- [x] **Cutover para o projeto São Paulo (`tmyeunithjqkbwvezyyn`).** Feito:
      env vars trocadas local + Vercel (confirmado pelo header CSP em
      produção apontando pro projeto novo), SMTP customizado corrigido
      (usuário `resend`, não `rezende`), Site URL/Redirect URLs corrigidos,
      reset de senha testado ponta a ponta com sucesso.
- [x] **MEI baixado.** Confirmado pelo dono nos canais oficiais (gov.br +
      Meta Business Manager), CNPJ ativo, Meta Business verificado. Tinha
      aberto a trava do WhatsApp Cloud API, removida em 13/08 (decisão de
      produto, sem relação com o MEI em si).
- [ ] **Cobrança da Fani Mayara** (`fanimayara67@gmail.com`): usuária real
      (logou em 11/08, 1 lead), plano `free`, começou o checkout e nunca pagou.
      Tem 2 cobranças de R$ 49 em aberto que vão virar aviso de vencimento.
- [x] **Pix real de R$ 49 recebido.** Workspace "Orne", 13/08, confirmado no
      Asaas, mas o webhook não chegou (site fora do ar por DNS, ver acima) e
      ficou preso até reconciliação manual. Motivou o job de reconciliação
      automática (ver "Onde o produto está").
- [ ] **Vercel Pro + Supabase Pro** no primeiro cliente pagante. Vercel por
      regra (Hobby proíbe uso comercial); Supabase por **backup**, o Free não
      faz nenhum, e perder dado de cliente pago é problema jurídico.
- [ ] **Sujeira em aberto:** os workspaces `Henrique System` e `pedro eee`
      estão `pro` com a assinatura já cancelada no Asaas. Cancelei por API e o
      banco não acompanhou; o webhook registrou 5 `SUBSCRIPTION_DELETED` sem
      aplicar. Causa não determinada, investigar antes de confiar no
      cancelamento automático.
- [x] Rate limit de e-mail de 30 para 100/hora. Feito.
- [x] Colar os templates `confirmacao-cadastro.html` e
      `recuperacao-de-senha.html` no painel. Feito e verificado com envio real:
      o link sai como `.../redefinir-senha?token_hash=…`.
- [x] Cancelar as assinaturas de teste no Asaas. Feito, eram 3, não 2.
- [x] **Meta Ads MCP conectado (13/08).** Conta de anúncio `27108979755418323`
      (BRL, `ACTIVE`, com método de pagamento) é a do Velo Funil, confirmada
      pelo dono entre as duas contas que a autenticação trouxe (a outra é
      `Rickdaskin Ads`, negócio de terceiro). Serve pra gerenciar campanha
      pelo Claude Code direto, mas isso não substitui a pendência acima: o
      Pixel (`NEXT_PUBLIC_META_PIXEL_ID`) ainda precisa ir pra env var da
      Vercel, e o Pix real de R$ 49 ainda precisa ser pago antes de ligar
      qualquer campanha de verdade.

## Fila técnica, na ordem

1. **Exportar para Excel/CSV.** Tira a objeção "vou ficar preso no sistema" na
   hora da venda. É o próximo, e o mais barato dos que restam.
2. **Dashboard de receita.** Ganho no mês e ticket médio saem do que já existe.
   Tempo médio de fechamento ainda não: exige histórico de MUDANÇA de etapa, e
   a 0033 guarda só a última, saber que um negócio está em "Negociação" há 12
   dias não diz quanto ele levou em "Proposta".
3. **Sandbox do Asaas nos testes de checkout.** Hoje o checkout é exercitado
   contra produção, e foi isso que deixou 2 cobranças de R$ 49 em aberto no nome
   de uma usuária real. O resto do projeto continua provando contra produção, a
   exceção é só onde o teste **cria cobrança no nome de outra pessoa**.
4. **Monitoramento de erro.** Não existe nenhum: erro em produção morre em
   `console.error` no log da Vercel, e a próxima tela de erro só aparece quando
   um cliente reclamar.
5. **Campos e pipelines customizáveis.** `deal_stage` é enum do Postgres; virar
   tabela é mudança grande. Só com cliente pagante pedindo.

**Entregues em 12/08, saíram desta fila:** paginação do que não paginava
(0032), e negócio parado (0033).

## Decisões travadas, não refazer

| Decisão                                     | Motivo                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asaas, não Stripe**                       | Existe skill/agente de Stripe no repo; não se aplica ao billing                                                                                               |
| **Sem prova social inventada**              | A `StatsSection` já teve métrica falsa copiada de concorrente, removida de propósito. Só entra com cliente real                                               |
| **Login não revela se a conta existe**      | Distinguir "senha errada" de "conta inexistente" permite enumerar e-mails e alimenta phishing. O erro oferece "Criar conta" e "Recuperar acesso" em vez disso |
| **Logo do e-mail é tipografia, não imagem** | Gmail e Outlook bloqueiam imagem por padrão; cabeçalho com `<img>` aparece vazio                                                                              |
| **Google Sheets por API está fora**         | Exige `GOOGLE_CLIENT_ID`/`SECRET` e verificação do app pelo Google (semanas). A importação de planilha já cobre a dor                                          |
| **`read-excel-file`, não `xlsx` nem `exceljs`** | O `xlsx` do npm está parado em 0.18.5 com CVE-2023-30533 e CVE-2024-22363, sem correção publicada lá; o `exceljs` está sem release há anos                |
| **Lead precisa de e-mail OU telefone**      | A planilha do público-alvo é lista de WhatsApp. Com `email not null` ela importava zero linhas (migration 0025)                                               |
| **WhatsApp: só o link `wa.me`, sem Cloud API**| A Cloud API foi implementada em 12/08 e removida em 13/08 (decisão de produto, nunca teve conexão real em produção), o link `wa.me` nunca dependeu dela e continua existindo |
| **Meta Lead Ads ainda adiado**              | Puxar lead da página de um cliente exige OAuth dele + App Review (semanas) + verificação de negócio, degrau acima do que o CNPJ ativo resolve sozinho. Guardar o padrão certo: webhook **mais** job de reconciliação, porque o Meta só guarda 90 dias |
| **IA / lead scoring fora**                  | Com 50 leads é ruído caro. O funil já pontua sozinho: negócio sem próxima ação e tarefa vencida são o sinal |
| **GA4 fora**                                | Ferramenta de site, não de app logado, mediria pageview, não ativação, e traria banner de cookie por LGPD. A necessidade é real; a ferramenta é que estava errada |
| **Tarefa não entra no limite de plano**     | Travar follow-up empurra a pessoa de volta para o WhatsApp e mata o hábito diário que faz ela pagar. O teto de 5.000 abertas é defesa contra abuso, não regra de negócio |

## Armadilhas já pagas, não repetir

**`cache()` do React deduplica a MESMA função, não duas que fazem a mesma
coisa.** `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding` (chamadas em
paralelo no layout do dashboard a cada navegação) cada uma tinha seu próprio
`cache(async () => supabase.auth.getUser())`, o React não enxerga que as duas
pedem a mesma coisa, então cada navegação pagava a ida ao Supabase Auth duas
vezes em vez de uma. A correção não é "cachear mais forte": é ter UMA função
cacheada (`lib/supabase/usuario-autenticado.ts`) e todo mundo chamar ELA, para
o `cache()` ter algo de fato idêntico para deduplicar.

**Layout `async` sem `<Suspense>` esconde que a navegação está rodando.**
`app/(dashboard)/layout.tsx` faz `await Promise.all(...)` antes do `return`,
nenhum `loading.tsx` de rota aparece enquanto isso não resolve, porque não há
fronteira de Suspense delegando o fetch. Clique processa, navegação começa,
mas fica muda por toda a cadeia de rede; sem sinal nenhum, a pessoa clica de
novo achando que não funcionou. Não dá para envolver esse `await` em Suspense
sem enfraquecer o guard: os dois `redirect()` do layout (workspace vazio,
onboarding pendente) dependem do resultado dele para decidir SE a página
deve renderizar. A correção ficou no lado visual,
`components/layout/navigation-progress.tsx` liga no clique real e desliga na
troca real de rota, não em tentar apressar o guard.

**O PostgREST corta em 1.000 linhas, e quem não pagina mente em silêncio.**
Medido em 12/08 com 1.100 negócios: o app recebe 1.000 e não recebe erro
nenhum. Três funções são anteriores a isto e não paginam, `getFunnelCounts`
(gráfico com número errado), `getBoardDeals` (**cards somem do Kanban**, e como
ordena por data são os mais antigos) e `getWorkspaceLeadsForSelect` (leads
somem do seletor de novo negócio, ordenado por nome). O banco tem 14 negócios
hoje, então ninguém é afetado, mas qualquer consulta nova sem `.limit()`
explícito herda o mesmo defeito.

**PATCH que não casa com nenhuma linha devolve 204, e 204 é sucesso.** O
primeiro roteiro de prova da 0030 deu um `check constraint` como aprovado sem
nunca tê-lo exercitado: a conta de teste não tinha linha em `onboarding_state`,
o `PATCH` não casou com nada e o script leu o 204 como "passou". Prova de
constraint precisa garantir que a linha existe antes.

**`.select()` do supabase-js precisa ser string LITERAL.** Quebrar em
`'a, b' + 'c, d'` para caber na linha faz o tipo do retorno inteiro virar
`GenericStringError`, o supabase-js analisa essa string no nível de tipo.

**`storage.foldername(name)[1]::uuid` estoura em caminho fora do padrão**, e
quem escolhe o caminho é quem envia o arquivo. A 0031 usa
`workspace_do_caminho`, que devolve `null` nesse caso, e
`is_workspace_member(null)` é `false`, então caminho torto não pertence a
ninguém.

**No `update` de policy, `using` sem `with check` deixa renomear para fora.**
Só com os dois é que um admin fica impedido de mover o próprio arquivo para a
pasta de outra empresa: `using` avalia a linha ANTES da mudança e aprovaria.

**`revoke select (coluna) ... from authenticated` sozinho não bloqueia nada.**
Mesma família de defeito que a 0013 já pagou para `EXECUTE` de função: o
Supabase concede `select` na TABELA INTEIRA para `authenticated` por default
privilege, e revogar uma coluna não subtrai de um grant mais amplo já
concedido. Achado testando `integration_connections` (0034), um admin lia
`access_token_enc` cifrado direto pela API pública, apesar do `revoke`
explícito na migration. A correção que funciona: revogar `select` da tabela
inteira e conceder de volta só nas colunas seguras, para o grant específico
ser o único que existe.

**Quem aceita convite não tem empresa para configurar.** Sem marcar o
onboarding como concluído no aceite, nos DOIS caminhos, a página e a Server
Action,, o middleware manda a pessoa às boas-vindas e ela atravessa quatro
perguntas sobre uma empresa que não é dela.

**Abrir tour por parâmetro de URL exclui quem não passa pela URL.** A primeira
versão dependia de `?tour=1`, posto pela finalização do assistente; quem entra
por convite nunca passaria por lá. O gatilho é o estado no banco.

**O servidor da Vercel roda em UTC, e "hoje" do usuário não é o dele.** Às 21h
de São Paulo já é o dia seguinte em UTC, `toISOString().slice(0,10)` no
servidor mandaria toda tarefa marcada para hoje à noite para o grupo "Depois".
Por isso `diaEmSaoPaulo` usa `Intl.DateTimeFormat` com `timeZone`, e o relógio
das telas de tarefa nasce num `useEffect`, no cliente. Tem teste travando os
dois casos em `lib/tasks/buckets.test.ts`.

**Prefixar `55` em número de 11 dígitos transforma telefone dos EUA em
brasileiro.** `+1 415 555 2671` vira `14155552671`, mesmo tamanho de um celular
com DDD. O teste pegou. O que separa os dois é o dígito depois do DDD: celular
brasileiro é sempre `9`, fixo começa em 2–5. Sem isso o `wa.me` abriria tela de
erro do WhatsApp e pareceria defeito nosso.

**`select` largo em rota sem paginação dobra o custo dela.** O `/kanban`
carrega todos os negócios abertos de uma vez. Medido em produção com 100
negócios: a consulta da próxima ação com as 8 colunas de `TaskRow` custava
315 B por negócio contra 292 B da consulta de negócios, mais que dobrava a
rota. Com as 5 colunas que o card usa de fato, 198 B. Daí o tipo
`ProximaAcaoRow` separado.

**`Map` não sobrevive à travessia servidor→cliente.** Prop de Server Component
é serializada; `Map` chega vazio, sem erro. Vai como pares `[chave, valor]` e
vira `Map` num `useMemo` do lado do cliente.

**O overlay do arrasto duplica o card à mão.** `deal-card-overlay.tsx` repete a
marcação de `deal-card.tsx`. Mudar um sem o outro faz o card trocar de altura no
instante em que é pego, e o movimento parece defeito.

**Contar linha com `for update` nem sempre vale.** A 0026 precisou do lock
porque 50 leads é fronteira de monetização e o 51º é receita perdida. O teto de
tarefas da 0029 é 5.000, defesa contra abuso: sob corrida o estouro é do tamanho
da concorrência e para na leva seguinte. O lock ali seria na MESMA linha de
workspace que a trava de leads pega, e faria toda tarefa criada durante uma
importação de planilha esperar a importação inteira.

**Regra que só vive na Server Action não é regra.** Server Action é endpoint
HTTP; quem chama o PostgREST direto com a chave pública (que está no HTML por
design) pula a validação. Três defeitos vieram disso: autoupgrade para Pro sem
pagar (migrations 0019→0022), limite de leads contornável (0023) e autoconvite
(0024). Limite de plano e permissão precisam de trigger no banco.

**`SECURITY DEFINER` troca o dono da execução, não o papel da sessão.** A 0019
liberava por `role = 'service_role'` e bloqueou o próprio webhook.

**Variável de sessão é forjável.** A 0021 liberava por uma marca posta pela
RPC; `set_config` é chamável por qualquer um e o ataque voltou a passar. Só
credencial secreta (service role) distingue de verdade.

**Trigger que conta linhas precisa de `for update`.** A 0023 recusava a partir
de 50 leads, mas sob READ COMMITTED duas transações liam a MESMA contagem antes
de qualquer commit e as duas passavam, 51 leads num plano de 50. Corrigido na
0026 com `select ... for update` na linha do workspace.

**Fragmento de URL (`#access_token`) nunca chega ao servidor.** Causou três
bugs: reset de senha morto, confirmação de cadastro que não logava, e a troca
de senha que não acontecia (o `PUT /user` sumia na travessia navegador↔Server
Action). Tudo que depende da sessão de recuperação roda no cliente.

**`File.text()` decodifica sempre em UTF-8.** O Excel em português salva CSV em
Windows-1252, então "José Antônio" entrava no banco como `Jos� Ant�nio`, calado.
Medido em 11/08. A leitura passa por `decodificarPlanilha`, que tenta UTF-8 com
`fatal: true` e cai para Windows-1252 quando falha, nessa ordem, porque
Windows-1252 aceita qualquer byte e nunca falharia.

**`.in()` do PostgREST vira query string.** A dedupe da importação mandava até
1000 e-mails num `select`, e o gateway recusa: medido, 500 valores já dão 400 e
2000 dão 414. Pior, o código não olhava o `error`, então o conjunto de
duplicados saía vazio e a planilha inteira era reimportada em silêncio. Trocado
por leitura paginada do workspace.

**Link de e-mail não carrega parâmetro.** O link de confirmação é montado pelo
template do Supabase e só sabe ir para o `emailRedirectTo` fixo, então tudo que
a pessoa escolheu antes de abrir a caixa de entrada morre ali. Dois defeitos
vieram disso: o convite virando conta separada (o token se perdia no caminho
para `/cadastro`, a pessoa caía em `/onboarding` e criava a própria empresa, com
o convite preso em `pending`) e a intenção de compra descartada ("Assinar Pro"
apontava para o mesmo destino do Free). A travessia agora é por cookie
`httpOnly` em `lib/auth/intencao.ts`, não querystring, que vazaria e-mail e
token no histórico e no `Referer`.

**Coluna de plano e validade de plano são coisas diferentes.** Depois da 0027,
qualquer regra que leia `workspaces.plan` pode discordar de `pro_vigente()`, a
coluna é o último valor gravado e não sabe que o tempo passou. Foi o caso do
aceite de convite (0028): um Pro vencido aceitava o terceiro membro e a trigger
de leads recusava o lead dele. **Regra de plano lê a função, nunca a coluna.**

**O `callback.successUrl` do Asaas não funciona.** Medido em 11/08:
`POST /subscriptions` aceita o campo com HTTP 200, não o devolve na leitura, não
propaga para a cobrança gerada, e `PUT /payments` com `callback` responde 500.
Por isso o retorno depois do pagamento é feito por conta própria, a fatura abre
em outra aba e o app fica na de trás.

**Erro do Postgres não chega à UI sozinho.** A mensagem de limite de plano da
trigger 0023 morria em `console.error` e virava "Não foi possível importar".
Quem trata `error.code === '42501'` é o TypeScript, e a mensagem boa precisa
existir dos dois lados.

**O editor de templates do painel do Supabase** engasga com linha de mais de
mil caracteres e rejeita comentário condicional aninhado, o botão "Save"
simplesmente não responde, sem erro. Por isso os arquivos em
`supabase/email-templates/` são gerados com `paraPainelDoSupabase: true`.

**`{{ .ConfirmationURL }}` verifica o token no próprio GET, antes do clique.**
Causou "link expirado" em confirmação de cadastro e recuperação de senha,
qualquer requisição que visite o link primeiro (scanner de e-mail, antivírus,
preview de webmail) consome o token de uso único antes da pessoa clicar. Os
dois templates usam `{{ .RedirectTo }}?token_hash=...`, que só carrega a
página; a verificação (`verifyOtp`) espera um clique explícito. Ver
`supabase/email-templates/README.md`.

**O nome do recebedor na fatura do Asaas não é editável, e para MEI não tem
mais saída por nome fantasia.** O campo `availableCompanyNames` da API traz só
a razão social vinda da Receita, para MEI, é o nome pessoal do empresário
individual, sem opção alternativa. **Correção 13/08/2026**: esta entrada dizia
antes que cadastrar nome fantasia no Portal do Empreendedor resolveria, errado,
o dono trouxe a fonte oficial (gov.br, resposta de 21/11/2023): nome fantasia
foi **descontinuado da base do CNPJ para MEI desde 15/11/2023**. Não é
limitação do Asaas nem trocaria com outro processador (Stripe incluído), é
dado da Receita Federal. Única saída real é formalizar como ME/LTDA (sair do
MEI), decisão de negócio fora do código. O que já mitiga: a descrição da
cobrança (commit `b8b9ec0`) mostra "Velo Funil" antes do nome do recebedor.

## Como verificar as coisas aqui

O padrão do projeto é **provar contra produção, não supor**. Scripts
descartáveis em Node no diretório de scratchpad, lendo `.env.local` com
`node --env-file=.env.local`, sempre limpando o que criaram:

- **RLS**: simular sessão real com `set local role authenticated` +
  `set local request.jwt.claims` e tentar a escrita indevida.
- **Limite de plano**: encher até o teto pelo PostgREST e conferir que a linha
  seguinte toma `42501`. Foi assim que a 0025 e a 0026 foram aceitas.
- **Billing**: bater no webhook de produção com o token real e conferir o
  plano no banco.
- **E-mail**: disparar de verdade e ler o resultado no log do Resend.
- **Auth**: criar conta descartável, exercitar o fluxo, apagar no `finally`.

Nunca deixar dado de teste para trás.

## Ferramentas

MCP do Supabase e Playwright vêm de plugins e ficam em `~/.claude.json`, que é
da máquina, não do login. **O MCP do Supabase já apareceu apontando para o
projeto errado** (`zjhgoaoctboxdtygdwjs`, vazio, de outra conta) enquanto o
`.env.local` usa `unydqzzjokhjwcqufehr`. Confira o projeto antes de aplicar
qualquer migration por ele. O MCP do Stripe pede autorização e **não é usado**
(o projeto é Asaas). Quando o Playwright cai, o caminho é `curl` + análise do
HTML, ou script Node contra a API.

## Últimos commits relevantes

| Commit    | O quê                                                              |
| --------- | ------------------------------------------------------------------ |
| _(a fazer)_ | Tarefas com próxima ação, tela `/hoje` e WhatsApp por link (0029) |
| `312225b` | Seletor de empresa passa a trocar de empresa de verdade            |
| `3779d72` | Convite deixa de virar conta separada; confirmação de e-mail tem fim |
| `9fe5cd4` | Reimportar planilha atualiza quem já existe                        |
| `efcf2be` | Importação de planilha: Excel, mapeamento de coluna, negócio junto do lead |
| `b8b9ec0` | Descrição da cobrança que o cliente reconhece                      |
| `7b67e23` | Verificador de ambiente local                                      |
| `185f97c` | Link de confirmação deixa de morrer antes do clique                |
| `1a49eb6` | Troca de senha deixa de falhar em silêncio (movida para o cliente) |
| `faba2db` | Bloqueia autoconvite e convite para quem já é membro               |
| `c5ad888` | Impede upgrade sem pagamento; conserta a RPC do webhook            |

Para o resto: `git log` conta a história completa, com o porquê de cada
decisão.

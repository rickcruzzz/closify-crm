# Auditorias anteriores do Velo Funil

Saiu de [prd.md](prd.md) em 11/09/2026, **inteiro e sem resumo**.

## Por que foi separado

O PRD tinha 1.448 linhas, e esta seção sozinha ocupava as últimas 220. Ela é
histórico — o roteiro de auditoria de agosto, os checklists de deploy daquela
época e três rodadas de correção já aplicadas —, e histórico misturado com
requisito faz o documento parar de responder "o que o produto faz" numa
leitura.

**É o mesmo remédio de 04/09**, quando `estado-atual.md` chegou a 250 KB e
parou de funcionar como memória: numa mesma sessão foi proposto construir uma
coisa que já existia e estava descrita lá dentro. O conteúdo não estava
perdido; estava inalcançável na hora em que decidia alguma coisa.

**Nada foi descartado.** Esta é a leitura de quando você precisa do porquê
inteiro de uma auditoria de agosto ou do começo de setembro. O que continua no
PRD é o que descreve o produto de hoje.

---

## 8. Auditoria de qualidade e correção de bugs

Para garantir que o Velo Funil esteja pronto para produção, use este prompt de auditoria e correção como guia:

- Leia `CLAUDE.md`, `docs/prd.md` e `docs/plan.md`.
- Use o código atual como fonte de verdade.
- Corrija todos os bugs e inconsistências restantes no produto.

### Áreas de foco

- **Pagamentos e billing**
  - Audite `lib/asaas/*`, `app/api/webhooks/asaas/route.ts` e componentes de cobrança.
  - Verifique o uso correto de `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_API_URL`.
  - Garanta que o webhook ative o plano Pro e mantenha o estado do Supabase consistente.
  - Remova qualquer vestígio de exemplos ou instruções incompatíveis.

- **Autenticação**
  - Complete o fluxo de recuperação de senha em `app/(auth)/esqueci-senha` e `app/(auth)/redefinir-senha`.
  - Revise a necessidade de magic link e remova referências enganosas se não estiver pronto.
  - Configure Resend como SMTP customizado para Supabase Auth e verifique convites/resets.

- **Dados e produto**
  - Verifique persistência real de Kanban, leads, deals e atividades.
  - Garanta que o dashboard de métricas use queries reais e não dados mockados.
  - Valide filtros de período, contagem de pipeline e métricas de funil.
  - Verifique workspace, membros, convites, papéis e permissões.

- **Segurança e infraestrutura**
  - Execute build local e corrija erros de compilação.
  - Confirme que as migrations do Supabase estão completas e aplicáveis em produção.
  - Garanta que rotas protegidas, RLS e políticas de permissão estejam consistentes.
  - Atualize a documentação e as variáveis de ambiente de deploy para refletir Asaas.

- **Qualidade**
  - Alinhe textos e copy ao produto real.
  - Remova comentários e links que não se aplicam.
  - Sugira testes automatizados para fluxos críticos: auth, billing, webhook, kanban, leads e dashboard.

### Entregáveis esperados

1. Lista de correções realizadas.
2. Arquivos alterados.
3. Checklist final de deploy e validação para produção.

### Checklist de deploy/validação final

Cada item marcado tem prova, não impressão — o método está em
`docs/estado-atual.md` ("Como verificar as coisas aqui"). Atualizado 02/09/2026.

- [x] **Build local concluído sem erros.** `npx tsc --noEmit`, `npm run lint`,
      `npm test` (**944 testes**) e `npm run build:check`, os quatro limpos,
      rodados antes de cada commit. É `build:check` e não `build`: os dois
      escrevem em `.next` por padrão, e o build sobrescreve o mapa de chunks
      que o `npm run dev` está usando — a rota morre com `MODULE_NOT_FOUND` e
      o erro aponta para o arquivo recém-editado, parecendo defeito dele.
- [x] **Migrations aplicadas no Supabase de produção.** 67 arquivos de
      migration (a maior é `0068`) no projeto `tmyeunithjqkbwvezyyn`
      (`sa-east-1`). Conferido contra o catálogo real em 02/09: **20 tabelas**,
      **34 RPCs do projeto** (65 no catálogo, 31 são da extensão `pg_trgm`),
      **31 foreign keys**, **15 triggers** e **8 enums**, ver
      [schema.md](schema.md).

      A tabela nova desta rodada é `notificacoes` (0066), o sino de avisos
      dentro do produto. E a 0068 corrigiu uma função que **nunca havia
      funcionado**: `purge_old_feedback` apagava anexo direto de
      `storage.objects`, o Supabase proíbe isso por trigger, e a exceção
      abortava a transação inteira — nenhum relato foi apagado desde a 0060.
      Achado exercitando a rota de cron contra produção, que devolvia
      `{"ok": false}` todo dia num corpo de resposta que ninguém abre.

      A tabela `feedback` (0060) é o canal de suporte; as outras três da 0058 à
      0061 mexeram em
      coluna e política, não em estrutura.

      **Reescrever função por dentro não aparece em lista de catálogo**, e este
      projeto já pagou isso três vezes: a 0055 reescreveu `pro_vigente()`, a
      0056 criou uma `returns trigger` que o PostgREST não expõe, e a 0057
      mudou `create_workspace_with_admin` sem mover um número sequer. Quem
      monitorasse só a contagem não teria visto nenhuma das três.
- [x] **Webhook Asaas configurado em produção e validado.** Recebe, deduplica
      e aplica. Ganhou rede de segurança depois que um Pix real ficou preso
      por webhook não entregue: `/api/cron/reconciliar-assinaturas` roda 1×/dia
      e corrige divergência sozinho.
- [x] **Plano Pro ativado corretamente após evento de pagamento.** Pix real de
      R$49 confirmado (workspace "Orne", 13/08). Fluxo auditado ponta a ponta:
      pagamento libera, retry deduplica, cancelamento rebaixa, requisição sem
      token toma 401.
- [x] **Fluxo de auth completo.** Login, cadastro, reset de senha, convites e
      Google OAuth. Convite entra na empresa de quem convidou — bug de 22/08,
      corrigido e provado.
- [x] **Dashboard de métricas com dados reais e filtros.** Queries reais, zero
      mock. 8 presets de período mais intervalo customizado.
- [x] **Permissões e workspaces validados.** RLS provada 14/14 contra produção
      com sessão autenticada real (não `service_role`): isolamento entre
      empresas segura mesmo com a interface burlada. Limite de empresas do Free
      travado no banco desde a 0018, reprovado com a RPC real.
- [x] **Documentação interna alinhada com Asaas.** Sem vestígio de Stripe nos
      caminhos de cobrança. Em 30/08 o agente `payment-integration` (genérico
      de Stripe/PayPal/Square, zero menção a Asaas) foi removido do repo, e
      confirmou-se que a skill `stripe-integration` que o `CLAUDE.md` citava
      **nunca existiu** — a menção era falsa desde que foi escrita. As citações
      a Stripe que restam são de duas naturezas legítimas: referência de
      *design* (Attio, Stripe e Linear como padrão de tipografia em
      `hero-section.tsx` e `public-navbar.tsx`) e registro histórico de por que
      a formação original pedia Stripe e foi traduzida para Asaas
      (`docs/plan.md`).
- [x] **Texto e copy do produto consistentes com a solução real.** Jargão
      banido pelo `prd-copy-sem-jargao.md` eliminado das telas (Pipeline→Funil,
      Leads→Contatos, Dashboard→Resultados), incluindo o que a renomeação de
      19/08 tinha deixado passar.
- [x] **Testes automatizados para os fluxos críticos.** 944 testes cobrindo
      lógica pura em `lib/**`; cada caso documenta o defeito que o motivou.
      Ressalva honesta: `tests/e2e/funil-completo.spec.ts` **nunca foi
      executado** (exige `.env.local` e roda contra o Asaas). Ele não falha em
      `npm test` — falha no gate de deploy.

### Auditoria de usabilidade: o produto ensina a navegar e não a ativar (01/09)

[auditoria-usabilidade.md](auditoria-usabilidade.md) percorre o produto contra
produção, com conta descartável, e mede onde a pessoa fica sem saber o que
fazer. O número que orienta o documento inteiro:

```
42 empresas   17 com contato (40%)   13 com negocio   11 com tarefa
contatos por empresa   0: 25 empresas · 1-4: 11 · 5-19: 6 · 20+: nenhuma
onboarding             43 de 49 concluem   88%
```

**25 das 42 empresas nunca criaram um contato, e 88% concluem o assistente.**
O vão não está no onboarding — está depois dele.

*Ressalva que muda a leitura e não pode ser omitida:* a maior parte dessas
contas é teste do próprio dono. Isto **não mede cliente**, porque cliente
externo não existe. Mede o caminho que o produto oferece a quem chega.

**Três correções entraram, e as três removem obstáculo entre a pessoa e o
primeiro contato salvo:**

*A primeira tela era um relatório de um negócio que ainda não começou.* O
login cai em `/dashboard`, que abria com "Exportar relatório" e dez botões de
período — os dois calculados sobre zero linha. Medido no DOM: em 375px o botão
"Adicionar primeiro contato" ficava a **984px** do topo, e a tela do telefone
tem **812px**. A única ação que importa nascia abaixo da dobra. Os dois agora
dependem de haver o que relatar, por condição **derivada** de
`lerSinaisDeAtivacao` — voltam sozinhos no primeiro contato, e não há
preferência gravada para dessincronizar.

*Fechar o checklist de ativação era definitivo.* `ocultarChecklist` aceita
`true` e `false` desde que existe, e **a única chamada era com `true`**. Nove
das 49 contas já haviam fechado o card que é o único lugar do produto que diz
o que fazer em seguida, sem ter como reabrir. É a terceira aparição da classe
aqui: `/dono/alertas` teve "silenciar" sem "reexibir", e `/dono/suporte` teve
fila de relatos internos sem porta.

*A mesma ação tinha dois nomes.* `/hoje` — primeiro item do menu — chamava de
**cliente** o que Contatos, Funil e Resultados chamam de **contato**. A
renomeação de 19/08 padronizou o produto inteiro justamente para isso não
acontecer, e essa tela escapou dela.

**O achado de marketing, não implementado por ser decisão de copy:** a dor que
a landing vende desaparece assim que a pessoa entra. As descrições de tela
explicam o que a tela **é** ("Busque, filtre e acompanhe seus contatos"), não
o que ela resolve. A promessa do WhatsApp não é renegada — ela para de ser
dita, exatamente quando a pessoa decide se vale alimentar mais uma ferramenta.
O único texto que acerta é o estado vazio de `/hoje`.

### Três defeitos que estavam no ar, achados e corrigidos em 24/08

Registrados aqui porque os três compartilham a mesma característica: **nenhum
gerava erro visível**, e todos custavam cliente em silêncio.

1. **Tela preta no site inteiro.** Uma quebra de linha no valor de
   `NEXT_PUBLIC_META_PIXEL_ID`, colado na Vercel, transformava o script inline
   do pixel em JavaScript inválido. `next/script` injeta com `appendChild`
   durante o commit do React, então a exceção subia até `app/global-error.tsx`,
   de fundo `#0a0a0a`. Atingia **quem aceitasse os cookies**, em qualquer
   lugar. Efeito colateral: o pixel nunca mediu nada. Corrigido em dois níveis
   — `lib/analytics/pixel-id.ts` higieniza e recusa o que não for dígito, e
   `isolar-analytics.tsx` põe cada rastreador atrás de uma cerca, para
   **medição quebrada custar o dado, nunca a visita**.
2. **Loop infinito no onboarding**, descrito acima. Quatro contas presas.
3. **Perda silenciosa de mensagem no WhatsApp**, descrita acima.

O que permitiu achar os três rápido foi `error_logs` estar gravando e o banco
poder ser consultado pela condição exata do defeito — não leitura de código.

**Pendências que não são de código** (dependem de painel de terceiro, ver
`docs/estado-atual.md` → "Pendente do dono"):

- [x] ~~`CRON_SECRET` nas variáveis da Vercel~~ — **esta pendência era falsa.**
      Medido na API da Vercel em 25/08: a variável existe em `production` e
      `preview`, marcada `sensitive`. Ficou aqui por meses afirmando que o cron
      tomava 401 todo dia. Pendência falsa desvia atenção das reais, e por isso
      a linha fica registrada em vez de apagada.
- [x] **CNPJ novo — SAIU.** `68.877.105/0001-67`, Sociedade Empresária
      Limitada, ATIVA desde 28/08, Simples Nacional deferido a partir de 31/08.
      **O CNAE principal é 6311-9/00** (tratamento de dados e provedor de
      aplicação), não o 6202-3/00 que esta linha previa — o que a Receita
      registrou é mais preciso para SaaS do que o que aqui se supunha.
      Preencher `cnpj`, `endereco` e `razaoSocial` em `lib/legal.ts` reacendeu
      as seis superfícies de uma vez, sem editar nenhuma delas, exatamente
      como estava previsto que aconteceria.
- [ ] **Verificação do negócio na Meta — `pending` desde 01/09**, em análise
      humana (~2 dias úteis). É o degrau que resta antes do App Review do
      WhatsApp. Nenhuma linha de código a acelera.
- [ ] CSP em modo bloqueio — hoje está em `Report-Only`; falta decidir entre
      aceitar `'unsafe-eval'` ou isolar a dependência que o exige.
- [x] **Verificação OAuth do Google — APROVADA em 24/08** para
      `calendar.events.owned` e `gmail.send`. Conferido que os escopos batem
      com `lib/integrations/google.ts` e que o `client_id` é o do projeto
      aprovado.
- [x] **Conta de anúncio TROCADA em 09/09.** A antiga (`Rickdaskin Ads`, com o
      pixel `h-systens`) não podia veicular: restrição de Fraude e Decepção no
      perfil pessoal, aplicada em 06/07/2026, que desativa o Meta Pay — e sem
      Meta Pay nenhum meio de pagamento funciona, em conta nenhuma daquele
      usuário. A conta nova (`924551593583617`) vem de outro perfil, sem
      restrição, com o pixel `947005175128975`. Nada do histórico migra: o
      pixel novo nasce zerado, e os ~21 `CompleteRegistration` e 6 `Purchase`
      do antigo ficam para trás — perda irrelevante, porque alimentavam uma
      conta que nunca pôde gastar um real.
- [ ] Sandbox do Asaas nos testes de checkout — hoje o checkout é exercitado
      contra produção, e foi isso que deixou 2 cobranças em aberto no nome de
      uma usuária real.
- [ ] Segredo do webhook do Evolution **por conexão**, em vez de um único para
      todas as empresas. Não é buraco explorável hoje (só o dono tem acesso ao
      servidor), mas limita o estrago quando houver muitos clientes.
- [ ] Proxy residencial para o WhatsApp (~R$ 18/mês). Decisão do dono em 24/08:
      fica para depois, com a sessão medida em 100%. Se a oscilação voltar, é a
      primeira coisa a tentar — e aí deixa de ser opcional.

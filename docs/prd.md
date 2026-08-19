# PRD: Velo Funil

> Iniciativa de conversão Free→Pro (copy da landing, limites, checkout) tem
> PRD próprio: [prd-conversao-pro.md](prd-conversao-pro.md).

## 1. Contexto e Problema

Pequenas empresas de serviço no Brasil, agências, consultorias, clínicas, imobiliárias pequenas e
software houses, perdem negócios porque gerenciam vendas em planilhas, WhatsApp pessoal ou anotações
soltas. 62% das PMEs B2B ainda controlam o funil de vendas em planilha ou papel, e apenas 21% usam um
CRM SaaS dedicado. Quando a equipe cresce, os dados ficam espalhados sem controle de acesso, e leads
esfriam por falta de follow-up organizado.

## 2. Solução Proposta

O Velo Funil é um SaaS multi-empresa de gestão de vendas com pipeline visual Kanban, feito para
substituir a planilha em um dia. Cadastro de leads, pipeline Kanban com drag-and-drop, timeline de
atividades, dashboard de métricas e billing via Asaas, posicionado como "o CRM simples que cabe no
bolso de quem está começando".

## 3. Requisitos Funcionais

- Login e Autenticação
- Kanban
- Dashboards
- Multi usuário
- Multi empresa
- Permissões por usuário
- Parte premium (paga)
- Integrações (API)
- Busca e Filtros
- Landing Page
- Onboarding do Usuário
- Calendário
- Filtro de Período
- Exportação de Relatórios

### Funcionalidades Principais

**Login e Autenticação**
Login com Supabase Auth, incluindo recuperação de senha via Resend e Google OAuth.
Magic link foi descartado: com Google OAuth e recuperação de senha funcionando, ele
seria um terceiro caminho de entrada sem cobrir nenhum caso que os outros dois deixam
de fora.

Trocar senha, dentro do produto, exige confirmar a senha atual (checado pelo
estado real da sessão, não por um valor vindo do cliente). Só quem está
criando a primeira senha, chegando por login social, fica isento, ali não há
o que confirmar. Sem essa exigência, sessão sequestrada bastaria pra trocar a
senha e trancar o dono de fora da própria conta.

**Kanban**
Pipeline visual com drag-and-drop entre etapas, persistência no banco e cards com dados essenciais do negócio.

**Dashboards**
Painel com métricas principais, gráficos de funil e visão rápida dos negócios em aberto.

**Multi usuário**
Convite de colaboradores por e-mail e trabalho colaborativo no mesmo sistema.

**Multi empresa**
Cada empresa ou cliente possui um workspace separado e isolado por permissões.

**Permissões por usuário**
Papéis como Admin e Membro para controlar acesso e edição.

**Parte premium (paga via Asaas)**
Plano Free com limites e plano Pro com uso ilimitado, ativado por assinatura recorrente no Asaas.

Quem tenta usar um recurso Pro sem ser Pro vê mensagem diferente conforme o
caso: nunca assinou vê "Faça upgrade para conectar"; já foi Pro e a
assinatura venceu vê "Reative o plano". A distinção vem de
`integration_connections` ter alguma linha (só existe se o workspace esteve
Pro alguma vez), já que `subscriptions` guarda só o estado atual, sem
histórico.

**Integrações (API)**
Integração com serviços externos via API, incluindo Asaas, Resend e futuras automações.

Google Calendar e Gmail são conectáveis em **Configurações → Integrações**,
OAuth próprio (`/api/integrations/google/*`), separado do OAuth de login, que
não persiste refresh token utilizável em background. Um escopo por conexão
(`calendar.events` ou `gmail.send`, nunca os dois), token cifrado
(AES-256-GCM) e renovação automática perto de expirar. Botão "Adicionar ao
Google Calendar" na próxima ação do negócio, "Enviar e-mail" no painel do
lead, os dois registram atividade na timeline.

WhatsApp é só o link `wa.me` (ver **WhatsApp por link**, abaixo); a Cloud API
oficial da Meta foi implementada e depois removida, decisão de produto, nunca
teve conexão real em produção.

**Busca e Filtros**
Busca por nome, e-mail, empresa, status, responsável e data.

O campo "Lead vinculado" do formulário de negócio usa combobox com busca em
vez de lista solta, workspace com muitos leads exigia rolar a lista inteira
procurando pelo nome.

**Landing Page**
Página pública para apresentar o produto, gerar interesse e converter visitantes em leads.

**Onboarding do Usuário**
Fluxo guiado para ajudar o usuário a criar workspace, cadastrar lead e começar a usar o sistema rápido.

**Navegação (sidebar)**
Menu lateral em seções: grupo principal sem título (Hoje, Pipeline, Leads,
Dashboard, Calendário) e "CONFIGURAÇÕES" (Perfil, Equipe, Integrações,
Preferências). Perfil já existia como rota, só não tinha entrada própria no
menu, vivia escondido no menu do rodapé. "Preferências" é o antigo item
"Configurações", renomeado pra descrever melhor a aba de dados da empresa,
distinta de Perfil (dados da pessoa).

**Gestão de Leads e Contatos**
Cadastro completo de leads e contatos, com listagem, busca, filtros e página de detalhe com timeline.

**Pipeline Kanban de Vendas**
Etapas: Novo Lead, Contato Realizado, Proposta Enviada, Negociação, Fechado Ganho, Fechado Perdido.
Cards com valor, lead vinculado, responsável e prazo. Drag-and-drop via `@dnd-kit`.

**Registro de Atividades**
Tipos: Ligação, E-mail, Reunião, Nota.
Timeline cronológica vinculada a cada lead.

**Tarefas e Próxima Ação**
Tarefa com prazo, responsável e conclusão, presa a um lead ou a um negócio.
Tela **Hoje**, primeira do menu, agrupa em Atrasadas, Hoje, Próximos 7 dias e
Depois, com filtro entre "minhas" e "da equipe".

No card do Kanban a próxima ação ocupa o lugar do prazo do negócio: prazo é
previsão de fechamento, próxima ação é o que dá para cumprir hoje, e duas datas
no mesmo card fazem a pessoa não saber qual obedecer. Sem tarefa aberta o card
diz **"Sem próxima ação"**, negócio sem próximo passo é o que morre calado no
funil, e é a informação mais valiosa que o card pode dar.

Concluir uma tarefa grava a atividade correspondente na timeline do lead. Sem
isso o histórico teria buraco justamente no que foi feito por follow-up.

Tarefa não entra no limite do plano: travar follow-up empurraria a pessoa de
volta para o WhatsApp e mataria o hábito diário que faz ela pagar depois. Há um
teto de 5.000 abertas por empresa, que é defesa contra abuso pelo PostgREST, não
regra de negócio.

**Onboarding e ativação**
Quem cria conta passa por boas-vindas, responde 4 perguntas curtas (empresa,
segmento, modelo de venda, tamanho da equipe) e cai num Dashboard com checklist
de ativação. O assistente **retoma de onde parou**, o estado vive em
`onboarding_state`, uma linha por pessoa, não por empresa.

Pular é oferta de verdade: não bloqueia nada, guarda o que já foi respondido e
não volta a aparecer a cada login. Quem entra por convite não vê o assistente,
a empresa dele já está montada.

O checklist tem 5 itens e é **derivado** do estado real do workspace, não
gravado: apagar o único lead reabre o item. Um booleano salvo continuaria
dizendo "feito" e o produto mentiria sobre si mesmo.

O segmento é guardado e personaliza texto. **As 6 etapas do funil continuam
fixas**, elas são um enum do Postgres usado por `deals` e `leads` em 22
arquivos, e torná-las editáveis é um projeto próprio.

**Dados da empresa**
Identificação (logo, nome, nome fantasia, CNPJ, segmento, descrição), contato
comercial (e-mail, WhatsApp, telefone, site) e endereço completo. Só o nome é
obrigatório; CNPJ é opcional, validado pelos dois dígitos verificadores quando
preenchido.

A logo vive num bucket **privado** do Supabase Storage, isolado por empresa, e
é exibida por URL assinada. O tipo do arquivo é conferido pelos bytes iniciais,
não pela extensão nem pelo `Content-Type`, os dois são escolhidos por quem
envia.

**Negócio parado**
`deals` guarda quando a ETAPA mudou pela última vez, separado de qualquer outra
alteração. Um negócio cujo valor foi corrigido ontem mas que está na mesma
etapa há três semanas conta como parado; usar a data de edição esconderia
exatamente esse caso.

Aparece como filtro "Parados" no Pipeline, com contagem, e só quando existe
algum, num funil saudável o botão fica escondido. O card não mostra:
lá já mora a próxima ação, e duas datas competindo fazem a pessoa não saber
qual obedecer.

Catorze dias é o limite. É escolha, não medição, quando houver histórico de
mudança de etapa, vira média por etapa.

**WhatsApp por link**
Lead com telefone válido ganha "Chamar no WhatsApp", abrindo `wa.me`. A Cloud
API oficial exige Meta Business verificado, que exige CNPJ ativo, mais aprovação
de template e custo por mensagem, o link resolve o que a pessoa quer, que é
abrir a conversa, sem nenhuma dessas dependências.

**Dashboard de Métricas**
Cards com Total de Leads, Negócios Abertos, Valor do Pipeline e Taxa de Conversão.
Gráfico de funil feito com Recharts.

**Exportação de Relatórios**
Botão "Exportar relatório" no Dashboard captura a área de métricas em PDF
(`html2canvas-pro` + `jspdf`), já com o nome do workspace e o rótulo do
período aplicado, pra dono levar o funil pra uma reunião sem precisar
printar tela.

**Filtro de Período**
Oito presets (Hoje, Ontem, 7 dias, 30 dias, Mês, Mês passado, Trimestre, Ano)
mais intervalo customizado, com um range picker visual: grade de mês
navegável, hover mostra o intervalo em preview antes do segundo clique, dois
meses lado a lado no desktop e um mês dentro de um painel deslizante no
mobile. Substituiu dois campos de data soltos e desconectados. Sem
biblioteca de calendário de terceiro, `@base-ui/react` (base de toda a UI do
produto) não tem primitivo de data, e a grade de 42 células é a mesma
reusada pelo Calendário completo, abaixo.

**Calendário**
Tela **Calendário**, no menu entre Dashboard e Configurações, com três
modos sobre as tarefas que já existem, sem tabela nova: **Mês** (grade com
até 3 tarefas por dia e "+N"), **Semana** (7 colunas, mais espaço por dia,
pensada pra ver conflito de horário) e **Agenda** (lista cronológica
agrupada por dia, é a mesma tela **Hoje** sem o filtro de "só minhas
abertas"). Cor por urgência e ícone por tipo, mesmos que Kanban e Hoje usam,
os três lugares não podem discordar sobre o que é urgente. Diferente da
tela Hoje, o Calendário mostra tarefa concluída também, é "o que aconteceu
e vai acontecer neste período", não "o que falta fazer". Semana busca dados
do servidor quando a pessoa navega pra fora dos 42 dias que a página
carregou de início.

Ficaram de fora deliberadamente, medido contra produção (12 tarefas em 21
workspaces, 1 integração conectada): página de histórico/auditoria dedicada
e rastreabilidade de sincronização/permissão. Mesmo volume que já reprovou
IA/lead scoring e a Cloud API do WhatsApp neste projeto; a timeline por lead
já cobre auditoria nesse volume.

### Multi-empresa e Colaboração

Workspaces separados por empresa ou cliente. Convite de colaboradores por e-mail via Resend. Papéis: Admin e Membro. Isolamento total de dados via RLS no Supabase.

### Monetização (Asaas)

Plano Free: 1 empresa, até 2 colaboradores e 50 leads.
Multi-empresa é recurso do Pro, sem esse limite, o teto de colaboradores não
segura nada: bastava criar uma empresa nova para cada dupla.
Plano Pro: colaboradores e leads ilimitados por R$49/mês.
Cliente e assinatura criados via API do Asaas, com cobrança recorrente e webhook para ativação automática.

## 4. Personas de Usuário

**Dono do Negócio / Empreendedor (Admin)**
Pequeno empresário de serviços que hoje controla vendas em planilha, WhatsApp ou caderno. Ele cria o workspace, convida a equipe, acompanha o funil e paga a assinatura quando percebe valor. É o decisor principal e o foco de monetização do produto.

**Gestor Comercial / Coordenador de Vendas**
Responsável por organizar o time, acompanhar metas e garantir que o funil não fique parado. Tem dor forte com previsibilidade, produtividade e controle de pipeline, então tende a valorizar dashboards e automações.

**Vendedor / Colaborador (Membro)**
Usuário diário do CRM, responsável por cadastrar leads, mover negócios no Kanban e registrar atividades. Sua experiência impacta diretamente a adoção do produto e o churn.

**Freelancer / Consultor (Admin Solo)**
Profissional independente que atende vários clientes e precisa separar dados por workspace. Usa o sistema para organizar sua operação e aumentar produtividade, com alta chance de começar no Free e subir para Pro.

**Agência / Parceiro de Revenda**
Perfil secundário que pode recomendar ou revender o produto para clientes. É importante para aquisição orgânica, indicações e escala comercial sem depender só de tráfego pago.

**Dono de Pequena Empresa em Crescimento**
Empresário que já vende bem, mas sente que perdeu controle da operação comercial. Busca uma solução simples, bonita e profissional que ajude a organizar equipe, rotina e previsibilidade de receita.

## 5. Stack Técnica

- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Supabase
- Asaas
- Vercel
- Claude Code
- Node.js
- PostgreSQL
- TypeScript
- Resend (e-mails)

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui, TypeScript 5, @dnd-kit, Recharts.
- Backend/API: Next.js API Routes + Server Actions, Node.js runtime.
- Banco de Dados + Auth: Supabase (PostgreSQL + RLS + Auth + Storage).
- E-mail: Resend para recuperação de senha, convites, onboarding e notificações; SMTP customizado no Supabase Auth.
- Pagamento: Asaas (clientes, assinaturas, webhooks, Pix/boleto/cartão).
- Deploy: Vercel.
- Dev / IA: Cursor + Claude Code.
- Analytics: Vercel Analytics. PostHog não está instalado, não existe nada
  medindo ativação hoje.
- Automação futura: n8n, Notion API, Linear API. WhatsApp Business Cloud API
  foi implementada e removida (13/08), decisão de produto; ver **WhatsApp por
  link**, acima.

Selecione/adicione no formulário: Next.js, React, Tailwind CSS, shadcn/ui, Supabase, Vercel, Claude Code, Node.js, PostgreSQL, TypeScript, Resend (e-mails).

**Observação:** Stripe não entra no projeto final; use Asaas para pagamentos.

## 6. Linguagem de Design

**HubSpot CRM**
Referência para credibilidade, organização de dados e onboarding bem guiado. O valor aqui é passar sensação de sistema completo e confiável, sem copiar a complexidade excessiva do produto.

**Pipedrive**
Referência principal de experiência de pipeline. Use como benchmark para Kanban de vendas, drag-and-drop fluido, leitura rápida dos cards e foco total em fechamento de negócios.

**Linear**
Referência de acabamento premium. Minimalismo, tipografia forte, espaçamento preciso, estados bem resolvidos e sensação de software rápido, caro e moderno.

**Calendly**
Referência para estratégia de freemium e conversão. O produto entrega valor no plano grátis, mas cria limites claros que fazem o upgrade parecer natural quando o uso cresce.

**DataCrazy**
Referência brasileira para posicionamento local, linguagem simples e produto adaptado à realidade de PMEs. Ajuda a manter o CRM próximo do mercado nacional e do jeito que o usuário brasileiro entende.

### Direção visual desejada

Um CRM com aparência premium, limpa e confiante. Interface escura como padrão, contraste alto, poucos elementos por tela, cards bem definidos, movimentos sutis e foco absoluto em clareza, velocidade e decisão. Deixar opção de modo claro e modo escuro.

### Frase de posicionamento visual

"Simples como planilha, premium como software líder."

## 7. Processo

- Dividir a construção do app em milestones lógicos (etapas).
- Cada milestone deve ser um incremento entregável.
- Priorizar funcionalidade core primeiro, depois iterar.
- Testar cada milestone antes de avançar para o próximo.

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

- [ ] Build local concluído sem erros.
- [ ] Migrations aplicadas no Supabase de produção.
- [ ] Webhook Asaas configurado em produção e validado.
- [ ] Plano Pro ativado corretamente após evento de pagamento.
- [ ] Fluxo de auth completo (login, cadastro, reset de senha, convites).
- [ ] Dashboard de métricas com dados reais e filtros.
- [ ] Permissões e workspaces validados.
- [ ] Documentação interna alinhada com Asaas.
- [ ] Texto e copy do produto consistentes com a solução real.
- [ ] Proposta de testes automatizados para os fluxos críticos.

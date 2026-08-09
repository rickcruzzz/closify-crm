# PRD: Velo Funil

## 1. Contexto e Problema

Pequenas empresas de serviço no Brasil — agências, consultorias, clínicas, imobiliárias pequenas e
software houses — perdem negócios porque gerenciam vendas em planilhas, WhatsApp pessoal ou anotações
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

### Funcionalidades Principais

**Login e Autenticação**
Login com Supabase Auth, incluindo recuperação de senha via Resend e Google OAuth.
Magic link foi descartado: com Google OAuth e recuperação de senha funcionando, ele
seria um terceiro caminho de entrada sem cobrir nenhum caso que os outros dois deixam
de fora.

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

**Integrações (API)**
Integração com serviços externos via API, incluindo Asaas, Resend e futuras automações.

**Busca e Filtros**
Busca por nome, e-mail, empresa, status, responsável e data.

**Landing Page**
Página pública para apresentar o produto, gerar interesse e converter visitantes em leads.

**Onboarding do Usuário**
Fluxo guiado para ajudar o usuário a criar workspace, cadastrar lead e começar a usar o sistema rápido.

**Gestão de Leads e Contatos**
Cadastro completo de leads e contatos, com listagem, busca, filtros e página de detalhe com timeline.

**Pipeline Kanban de Vendas**
Etapas: Novo Lead, Contato Realizado, Proposta Enviada, Negociação, Fechado Ganho, Fechado Perdido.
Cards com valor, lead vinculado, responsável e prazo. Drag-and-drop via `@dnd-kit`.

**Registro de Atividades**
Tipos: Ligação, E-mail, Reunião, Nota.
Timeline cronológica vinculada a cada lead.

**Dashboard de Métricas**
Cards com Total de Leads, Negócios Abertos, Valor do Pipeline e Taxa de Conversão.
Gráfico de funil feito com Recharts.

### Multi-empresa e Colaboração

Workspaces separados por empresa ou cliente. Convite de colaboradores por e-mail via Resend. Papéis: Admin e Membro. Isolamento total de dados via RLS no Supabase.

### Monetização (Asaas)

Plano Free: até 2 colaboradores e 50 leads.
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
- Analytics: PostHog e Vercel Analytics.
- Automação futura: n8n, WhatsApp Business API, Notion API, Linear API.

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

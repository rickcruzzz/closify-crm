# Trabalho autônomo — noite de 09→10/08/2026

Registro do que foi executado sem supervisão, para leitura na manhã seguinte.
Cada item traz o que mudou, por quê, e como foi verificado.

## Escopo aprovado

1. Caminho de upgrade em Configurações (receita)
2. Página `/perfil` separada de `/settings`
3. CRUD faltante: excluir negócio, editar/excluir atividade
4. Landing page profissional
5. Deploy e verificação em produção

## Não entregue — e por quê

**Integração com Google Planilhas (API).** Depende de credenciais que só o dono
da conta pode criar: projeto no Google Cloud Console, tela de consentimento
OAuth, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, e verificação do app pelo
Google — o escopo de Sheets é sensível e a revisão leva semanas. Sem essas
credenciais, qualquer código escrito aqui ficaria morto no repositório.

A dor imediata ("trazer os contatos da planilha") já está resolvida pela
importação de CSV construída antes: no Google Sheets, `Arquivo → Baixar → CSV`
e importar na tela de Leads. A integração por API entrega *sincronização
contínua*, que é outro recurso — e com custo de manutenção próprio.

O que dá para fazer sem credencial, e foi feito: deixar o caminho do CSV
explícito na interface e na landing, já que ele existia mas não era anunciado
onde a pessoa procura.

## Execução

### `cfe729c` — caminho de upgrade, perfil e CRUD

**Não havia como pagar.** O card "Plano" tinha um único botão `outline` ("Ver
cobrança") que levava a outra tela antes de qualquer possibilidade de assinar.
Agora lista o que muda no Pro e abre o checkout ali mesmo, reusando o
`SubscribeButton` (máscara e validação de CPF já prontas). Os limites vêm das
constantes — o texto anterior dizia "até 2 colaboradores e 50 leads", escrito à
mão e já desatualizado frente ao limite de 1 empresa.

**"Meu perfil" e "Configurações" abriam no mesmo lugar.** Eu havia ligado os
dois a `/settings` porque não existia página de perfil. Nova rota `/perfil`,
separada pelo dono do dado: pessoa (nome, e-mail, senha) versus empresa
(workspace, equipe, plano). A tela detecta quem entra pelo Google e oferece
"criar senha" em vez de "trocar".

**Faltava editar e excluir.** `deleteDeal`, `updateActivity` e
`deleteActivity` não existiam — negócio criado errado só mudava de etapa e
inflava o pipeline; atividade registrada por engano ficava para sempre.

A regra de autoria da atividade é explícita na Server Action: só o autor ou um
admin altera. A RLS de `activities` libera qualquer membro do workspace, porque
ela isola EMPRESAS, não pessoas da mesma empresa.

### `e224b48` — landing

**O menu sumia no celular.** `nav` era `hidden md:flex` sem hambúrguer, e
"Entrar" era `hidden sm:inline-flex` — cliente existente não acessava a conta
pelo celular. Agora há Sheet lateral com links e os dois CTAs.

**Nada explicava o que acontece depois do cadastro.** Nova seção "Como
funciona", em três passos, posicionada ANTES das funcionalidades: lista de
recursos só significa algo para quem já usou CRM.

**A importação de planilha não aparecia** em lugar nenhum da landing, embora
exista há dias. É a resposta para "vou ter que digitar tudo de novo?" — virou o
passo 01 e ganhou card próprio.

## Verificação

- `tsc`, `lint`, **93 testes** e `build` limpos em cada commit
- Deploy confirmado em produção nos dois casos
- Landing medida no DOM (375px e 1440px): sem scroll horizontal

## Dois falsos alarmes que investiguei e descartei

Registro para ninguém "corrigir" o que está certo:

1. **Landing aparentemente em branco no mobile**, com 17 elementos em
   `opacity: 0`. É o `RevealOnScroll` — rolando de verdade, tudo aparece. Era
   artefato do screenshot de página inteira, que não dispara o
   `IntersectionObserver`. O componente inclusive degrada bem sem JS.
2. **Seletor de "Responsável" listando leads.** Verificado contra o banco:
   nenhum lead está em `workspace_members` e o negócio criado tem responsável
   válido. Era erro do meu script de teste, que leu as opções de dois `Select`
   abertos ao mesmo tempo.

## Para a próxima rodada

- **Nenhum screenshot real do produto na landing.** O "preview" é um mockup em
  CSS com dados fictícios (`acme-corp`). Isso pesa em "deixar claro o que
  vendemos" e exige capturas reais do Kanban e do dashboard.
- **Nenhuma prova social.** Sem depoimento, logo de cliente ou número de uso —
  e não se deve inventar: a `StatsSection` já teve métricas falsas copiadas de
  concorrente e foram removidas de propósito.
- Duas assinaturas `ACTIVE` no Asaas (`pedro eee`, `Henrique System`) com
  faturas pendentes de R$ 49. Se forem testes, dá para cancelar pela tela de
  Cobrança.

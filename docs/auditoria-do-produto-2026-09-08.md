# Auditoria do produto: o sistema inteiro, e o mercado contra ele (08/09/2026)

Pedido do dono: percorrer o produto como usuário, avaliar se funcionalidades,
fluxos e arquitetura fazem sentido em conjunto, e confrontar com o mercado
usando o Exa.

**Decisões registradas dos pontos em aberto** (nenhum era bloqueante):

```
codigo/ambiente   c:\...\projetocrmm | .env.local | dev em localhost:3000
                  producao em www.velofunil.com.br
mercado           PME de servico no Brasil — agencia, consultoria, clinica,
                  imobiliaria pequena, software house (CLAUDE.md)
usuario e dor     dono/vendedor de PME que perde follow-up na planilha e no
                  WhatsApp. O h1 da landing: "A planilha organiza. Ela nao
                  avisa quem esta esperando"
```

Tudo abaixo separa **[VERIFICADO]** de **[NÃO VERIFICADO]**. Onde há número, há
a leitura que o produziu.

---

## 1. Diagnóstico do produto

O Velo Funil é um CRM **honesto e pequeno**, e as duas palavras importam.

**Honesto**: cada promessa da tela corresponde a algo que o código faz. Foi
auditado três vezes nesta sessão e as promessas falsas encontradas foram
corrigidas na hora — o card de Sinais prometia categorias que o classificador
não tinha, a landing chegou a anunciar trial que a `0057` removeu em 29/08.

**Pequeno**: ele faz funil, contatos, tarefas, calendário, importação e
exportação de planilha, e billing. Não faz automação, não faz IA, e **não faz
WhatsApp**.

### O elefante, dito primeiro

```
workspaces          44
leads               589   dos quais 510 sao a prospeccao do DONO
                          -> uso real de produto: ~79 contatos
deals               72
tasks               56
clientes externos
pagantes            ZERO
```

O produto está em produção há semanas e **nunca teve um cliente externo
pagante**. Toda decisão de produto abaixo é tomada sem um único dado de uso
real, e isso não é opinião — é o que o banco mostra.

---

## 2. Diagnóstico técnico

```
paginas             35
rotas de API        13
migrations          74 arquivos, a maior e 0075
testes              102 arquivos, 1.216 casos
tabelas             18
```

**A arquitetura é coerente e tem um padrão claro**, aplicado de forma
consistente:

```
regra de negocio      no BANCO, em trigger — nao so na Server Action.
                      "Server Action e endpoint HTTP; quem chama o PostgREST
                      direto com a chave publica pula a validacao"
puro separado de I/O  trial.ts / trial-queries.ts, prateleira.ts /
                      prateleira-queries.ts, google-ads.ts / -queries.ts
tudo por RLS          isolamento por workspace_id, com policy escrita e provada
a Central e local     /dono devolve 404 fora de localhost, porque le com
                      service role e ignora RLS
```

Cada arquivo carrega, em comentário, **o defeito que motivou a decisão**. Isso
não é estilo: é o que permitiu esta auditoria confirmar intenção em vez de
adivinhar.

**O ponto técnico mais forte** é a disciplina de prova: nada é dado como
funcionando sem exercitar o caminho real contra produção, com limpeza no fim.
**O mais fraco** é que essa disciplina é humana — não há CI que a imponha.

---

## 3. Análise dos fluxos do usuário

Percorrido com **conta descartável real**, criada pela API admin, logada pela
tela, apagada no fim.

### [VERIFICADO] As dez áreas do produto respondem

```
rota                 status   h1                observacao
/hoje                  200    Hoje              estado vazio bem escrito
/kanban                200    Funil             cartao de primeiros passos
/leads                 200    Contatos          lista com o contato semeado
/leads/[id]            200    Maria Auditoria   timeline, tarefas, negocios
/dashboard             200    Resultados        graficos e vazio explicado
/calendario            200    Calendario        mes/semana/agenda
/conversas             200    Conversas         WhatsApp em "migrando"
/perfil                200    Meu perfil
/settings              200    Configuracoes
/settings/billing      200    Cobranca
```

**Nenhuma tela quebrou.** Nenhum erro de JavaScript não catalogado.

### O fluxo que funciona melhor

`/hoje → contato → tarefa → funil` é curto, e cada tela devolve à seguinte. A
tarefa marcada some com desfazer, a próxima ação aparece no card do Kanban, e o
contato tem timeline com histórico. **É o núcleo do produto e ele está bem
feito.**

### O fluxo que ainda não fecha

`/conversas` existe, tem menu, tem tela — e o WhatsApp está em
`FASE_DO_WHATSAPP = 'migrando'` desde 28/08. O que sobra é o link `wa.me`. Um
item de menu que leva a uma tela que anuncia uma migração é dívida visível para
o usuário.

---

## 4. Evidências encontradas no sistema

### [VERIFICADO] ACHADO GRAVE: a senha vai para a URL no `/login`

`app/(auth)/(entrada)/login/page.tsx:160` — `<form onSubmit={...} noValidate>`
**sem `method`**. Formulário sem método faz **GET para a própria URL**. Antes de
o React hidratar, submeter dispara a serialização nativa:

```
/login     ?email=vitima%40exemplo.com&password=SenhaSecreta123%21   VAZOU
/cadastro  ?name=&email=vitima%40exemplo.com                         nao vazou
```

Reproduzido de propósito bloqueando o JavaScript — que é o caso real de conexão
ruim, aparelho lento ou chunk demorando, **não um cenário inventado**.

**Por que só o login vaza:** ele usa `{...register('password')}`, que espalha
`name="password"` no input, e input com `name` entra na serialização. O cadastro
usa `Controller` + `PasswordField`, cujo input não recebe `name`. **A tela de
cadastro está segura por acidente, não por desenho** — qualquer refatoração a
quebra.

**O estrago:** senha em histórico do navegador, em log de acesso do servidor, e
no cabeçalho `Referer` de qualquer requisição seguinte.

**A correção é uma palavra:** `method="post"` no `<form>`. O envio
pré-hidratação vira POST, e nenhuma credencial entra na URL.

### [VERIFICADO] O `gclid` é gravado e ninguém lê

```
capturado   components/landing/utm-capture.tsx
gravado     lib/onboarding/actions.ts:231
lido por    NINGUEM
no banco    0 de 44 workspaces
```

Mesma família do `utm_content` de 04/09. A `0071` escreveu o porquê na própria
migration — *"cada dia sem a coluna é um dia de cliques que nunca poderão ser
reconciliados com o dinheiro"* — e a metade que lê nunca nasceu.

### [VERIFICADO] O webhook do Asaas para sozinho, e é a terceira vez

`interrupted: true` em 04/09, 06/09 e 08/09. O endpoint está são o tempo todo
(401 sem token, 200 com token e evento não mapeado). O vigia tem a checagem
desde 04/09, mas **só avisa quando o estado muda** — e a memória dele registra o
último aviso em 06/09.

### [VERIFICADO, e é ruído] Quatro avisos do Base UI no console

`<Button render={<Link/>}>` sem `nativeButton={false}`. **Corrijo um alarme meu:
levantei que isso poderia estar quebrando cliques, e não está.** Conferidos os
25 usos: nenhum combina `render` de link com `onClick`, que é o caso em que o
handler é descartado. São navegações puras e funcionam.

Fica como **armadilha documentada**: hoje custou uma hora de investigação na
prateleira de prospecção, onde o `onClick` existia.

---

## 5. Evidências de mercado obtidas pelo Exa

18 domínios com preço publicado, página inicial e de preços, lidos em 07 e
08/09. Custo total: **US$ 0,15**.

### O que o mercado anuncia, e o que nós temos

```
funcionalidade          anunciam   Velo Funil
funil / kanban            14/18       TEM
relatorio / dashboard     14/18       TEM
multiusuario / equipe      4/18       TEM
integracao e-mail          4/18       TEM (Gmail, Pro)
importar planilha          1/18       TEM   <- praticamente so nos

IA (como recurso)         15/18       NAO TEM
automacao de fluxo        16/18       NAO TEM
WhatsApp (como recurso)    9/18       NAO TEM
proposta / orcamento       4/18       NAO TEM
assinatura eletronica      2/18       NAO TEM
telefonia                  3/18       NAO TEM
```

**Uma correção de medição, dentro da própria auditoria:** a primeira contagem
deu WhatsApp em 17 de 18. Estava inflada — o regex pegava "fale conosco no
WhatsApp", que é canal de suporte, não recurso. Refinado para casar
`CRM ... WhatsApp` e `integra ... WhatsApp`, caiu para **9 de 18**. Contar a
palavra e contar o recurso são coisas diferentes.

### [MEDIDO] A demanda existe, e o que trava é o LANCE — não o orçamento

Consulta ao Planejador de Palavras-Chave pela API, volume real do Brasil:

```
                            buscas/mes  concorrencia  lance de TOPO
crm gratis                      2.900      HIGH       R$ 11,21 - 67,57
crm de vendas                   1.300      MEDIUM     R$ 11,54 - 72,73
crm simples                     1.000      MEDIUM     R$  4,77 - 26,89
crm barato                        210      HIGH       R$  7,51 - 38,55
crm para pequena empresa          170      MEDIUM     R$ 10,87 - 40,25
crm nacional                      170      LOW
quanto custa um crm               140      MEDIUM     R$  3,61 - 20,49
                               ------
os 7 termos somados             5.890/mes
```

**O teto de CPC da campanha e R$ 3,00.** Em seis dos sete termos o lance de
topo COMECA acima disso. E a metrica que o proprio Google calcula confirma:

```
parcela de impressoes OBTIDA        10,0%
perdida por ORCAMENTO               10,3%
perdida por CLASSIFICACAO (lance)   89,7%
```

**Isto corrige uma conclusao que eu repeti varias vezes nesta sessao.** Eu disse
que o limite era demanda; nao e. A demanda existe e esta medida. O que limita e
o lance, e o proprio orcamento prova: R$ 750/mes autorizados contra ~R$ 20
gastos — 97% parado.

**Uma armadilha do mesmo dado:** `funil de vendas` tem 22.200 buscas/mes com
concorrencia LOW, e `crm` tem 246.000. Volume alto com concorrencia baixa quase
sempre significa intencao INFORMACIONAL — anunciante nao disputa porque nao
converte. Em `crm`, boa parte e "o que e crm", e 22.200 sao `crm minas gerais`,
que e o Conselho Regional de Medicina.

O unico termo de volume alto com intencao comercial E dentro do teto e
`sistema crm`: 8.100 buscas/mes, MEDIUM, lance a partir de R$ 3,19 — mais que
os sete atuais somados. Acrescentado a campanha em 08/09, junto de 6 sitelinks
e 8 frases de destaque, sem tocar em lance nem orcamento (o que reiniciaria o
aprendizado).

### O modelo de cobrança (medido em 07/09)

```
por usuario        9 de 18
nao declarado      7 de 18
fixo por empresa   2 de 18
```

Com uma pessoa, vários são mais baratos (avaly R$ 45). Com três, R$ 135 contra
os nossos R$ 49. **Não somos o mais barato — somos o que não sobe.**

### A porta de entrada (medida em 08/09)

```
teste self-serve   11/18       61% — nao nos diferencia
pede demo/vendas    6/18
plano gratis        5/18       estamos aqui
prazo declarado     8/18       6 deles dao 7 DIAS
trial que acaba
em PAREDAO          6 de 8      no oitavo dia, acesso cortado
```

Nós **não temos trial** (a `0057` removeu em 29/08) e temos Free até 50
contatos, sem prazo. **Ninguém é cortado nunca** — e ninguém nunca experimenta o
Pro.

**Fontes:** avaly.io, idealsales.com.br, agendor.com.br, propo.com.br,
clixx.com.br, meets.com.br, akiocrm.com, rdstation.com, moskitcrm.com,
ploomes.com, nexxou.com, trakium.chat, upgestao.com.br, bitrix24.com.br,
datacrazy.io, leads360.com.br, crm.agencianooma.com.br, unicocrm.com.

---

## 6. Inconsistências e problemas

| # | problema | onde | gravidade |
|---|---|---|---|
| 1 | Senha vai para a URL antes da hidratação | `app/(auth)/(entrada)/login/page.tsx:160` | **alta** |
| 2 | `gclid` gravado e nunca lido | `lib/onboarding/actions.ts:231` | média |
| 3 | Webhook do Asaas para sozinho, 3× em 5 dias | vigia / Asaas | média |
| 4 | `/conversas` no menu com WhatsApp em "migrando" | `lib/integrations/whatsapp-estado.ts` | média |
| 5 | Ninguém nunca experimenta o Pro | `lib/plans.ts` + ausência de trial | média |
| 6 | 25 usos de `render={<Link/>}` sem `nativeButton` | vários | baixa |
| 7 | Nada avisa quando a atribuição quebra em silêncio | `lib/dono/atribuicao.ts` | baixa |

### [NÃO VERIFICADO]

```
desempenho em producao      as rotas levaram 3 a 10s em DEV, que compila sob
                            demanda. Nao vale como medida
a tag do Google dispara     exige navegador com consentimento no dominio de
                            producao
o Purchase chega na Meta    o metodo do projeto e token invalido, e e escrita
                            a servico externo
acessibilidade completa     nao foi rodado leitor de tela nem auditoria WCAG
```

---

## 7. Conclusão: o quanto o produto faz sentido

**Faz sentido como produto, e ainda não como negócio.**

**O que sustenta o sim:** o núcleo (`/hoje` → contato → tarefa → funil) é curto,
coerente e bem executado. A arquitetura tem padrão e o aplica. A disciplina de
não prometer o que não entrega é real e visível no código. E a importação de
planilha — que praticamente só nós anunciamos — é exatamente a ponte que o
público-alvo precisa atravessar.

**O que sustenta a dúvida:** o mercado tratou IA (15/18) e automação (16/18)
como obrigatórias, e metade dele vende WhatsApp como recurso. O Velo Funil não
tem nenhum dos três. Isso não o torna pior para quem sai de uma planilha — mas o
torna **invisível na comparação** que essa pessoa faz antes de decidir.

**E o canal pago tem teto aritmético.** Os sete termos somam 5.890 buscas/mês, e
a campanha captura 10% das impressões. Mesmo com 100% de parcela, esse conjunto
entrega ~87 cliques/mês — que, à taxa que o próprio projeto estimou, viram 2 a 4
cadastros. **O anúncio não leva a dez clientes.** Ele serve para descobrir o CPC
real e qual palavra atrai quem se cadastra.

**O problema real não é nenhum dos dois.** É que **zero clientes externos**
significa que nenhuma dessas conclusões foi testada contra uma pessoa que paga.
O produto é bom o suficiente para a próxima decisão não ser mais código: é
conversa com as 882 empresas que já estão na prateleira.

**A única coisa desta auditoria que eu trataria como urgente é a senha na URL.**
É uma palavra de correção, e é a diferença entre um defeito teórico e uma
credencial em log de servidor.

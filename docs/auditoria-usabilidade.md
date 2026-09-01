# Auditoria de usabilidade, UI/UX e marketing

**Feita em:** 01/09/2026, contra <https://www.velofunil.com.br> em produção.

Método: conta e empresa descartáveis, percurso clicado no navegador, medição
no DOM real, e leitura do banco. Apagado tudo num `finally`.

Organizado **por impacto na ativação** — quanto cada achado atrasa ou impede a
pessoa de chegar ao primeiro contato salvo. Achado sem evidência observável
não entrou, pela lição de `/dono/alertas`, onde 8 de 11 alertas eram ruído.

---

## O número que orienta a auditoria inteira

```
42 empresas no banco
17 com 1+ contato      40%
13 com 1+ negocio      31%
11 com 1+ tarefa       26%

contatos por empresa   0: 25 empresas · 1-4: 11 · 5-19: 6 · 20+: nenhuma
onboarding             43 de 49 concluem   88%
tour                   31 completo · 11 pulado · 7 nao iniciado
```

**25 das 42 empresas nunca criaram um contato**, e nenhuma passou de 20. Ao
lado dos 88% que concluem o assistente, isso localiza o problema:

> O onboarding funciona. A **ativação** é que não acontece. A pessoa aprende a
> navegar e não chega ao momento em que o produto vale alguma coisa.

**Ressalva que muda a leitura, e não pode ser omitida:** a maior parte dessas
contas é teste do próprio dono (`lib/dono/contas-internas.ts`). Isto **não é
comportamento de cliente**, porque cliente externo não existe. O que ele mede
é o caminho que o produto oferece a quem chega — que é o objeto desta
auditoria, e vale independentemente de quem percorreu.

---

## ALTO — o que trava o caminho até o primeiro contato

### A1. A primeira tela é um relatório de um negócio que ainda não começou

**Problema.** O login cai em `/dashboard`. Para quem acabou de criar a conta,
essa tela abre com o título "Resultados — Quanto entrou, quanto está em jogo e
o que virou venda", um botão "Exportar relatório" em destaque, e dez botões de
período (Hoje, Ontem, Últimos 7 dias…). Nenhum deles tem sobre o que operar.
A única ação que importa fica no rodapé.

**Evidência.** Medido no DOM, conta nova e empresa vazia:

```
1440x900   "Adicionar primeiro contato" a 812px do topo   visivel por 88px
375x812    "Adicionar primeiro contato" a 984px do topo   ABAIXO DA DOBRA
```

No telefone, a pessoa precisa rolar para encontrar a única coisa que o produto
quer que ela faça. E 17 dos alvos de toque da tela têm menos de 44px de
altura, contra a regra que o próprio projeto aplica desde 18/08.

**Recomendação — implementada.** "Exportar relatório" e o filtro de período só
aparecem quando existe o que relatar. A condição é **derivada** de
`lerSinaisDeAtivacao`, não gravada: no instante em que houver o primeiro
contato os dois voltam sozinhos, e não há preferência para dessincronizar.
Ver `app/(dashboard)/dashboard/page.tsx`.

### A2. Fechar o checklist de ativação era definitivo

**Problema.** O checklist é o único lugar do produto que diz o que fazer em
seguida. Ele tem um "X" no canto. Clicado, nunca mais volta — e o estado vai
para o banco, então nem trocar de navegador desfaz.

**Evidência.** `ocultarChecklist` (`lib/onboarding/actions.ts:350`) aceita
`true` e `false` desde que existe. Varrido o repositório: **a única chamada
era com `true`**, em `checklist-card.tsx:35`. Medido no banco: **9 das 49
contas já haviam fechado**, e nenhuma tinha como reabrir.

É a terceira aparição da mesma classe aqui: `/dono/alertas` teve "silenciar"
sem "reexibir", e `/dono/suporte` teve fila de relatos internos sem porta.

**Recomendação — implementada.** `RetomarChecklist` em
`components/onboarding/checklist-card.tsx`: um link discreto que aparece
apenas para quem fechou **e** ainda tem passo aberto. Discreto de propósito —
quem fechou pediu para não ser incomodado; o que muda é que a porta existe.
Travado por `lib/onboarding/porta-de-volta.test.ts`, com controle negativo.

### A3. A mesma ação tinha dois nomes em telas diferentes

**Problema.** A tela `/hoje` chamava de **cliente** o que todo o resto do
produto chama de **contato**. Ela é o primeiro item do menu lateral.

**Evidência.**

```
/hoje      "Comece cadastrando um cliente"   botao "Cadastrar cliente"
/leads     "Nenhum contato ainda"            botao "Novo contato"
/kanban    "Cadastre seu primeiro contato"
/dashboard "Cadastrar o primeiro contato"
```

A renomeação de 19/08 padronizou o vocabulário do produto inteiro em
"Contatos" — exatamente para a mesma coisa não ter dois nomes. Esta tela
escapou dela, e é a que abre primeiro pelo menu.

**Recomendação — implementada.** `components/tasks/hoje-client.tsx` passa a
dizer contato.

---

## MÉDIO — o que atrapalha entender o produto

### M1. O assistente bloqueia o produto inteiro até terminar

**Problema.** Enquanto o onboarding não é concluído ou pulado, **todas** as
rotas do produto devolvem para ele.

**Evidência.** Medido com conta parada no passo 3: `/dashboard`, `/kanban`,
`/leads`, `/hoje` e `/calendario` redirecionaram para `/onboarding`,
reabrindo o mesmo passo. A skill `ui-ux-pro-max` classifica isso como
*Onboarding / User Freedom*: **"Don't: Force linear unskippable tour"**.

Existe "Pular por enquanto" em cada passo, então há saída — mas ela é um link
secundário no rodapé, enquanto o produto inteiro está fechado.

**Recomendação — não implementada, é decisão de produto.** Deixar o produto
acessível durante o assistente, mantendo o card de retomada no topo. O custo
de errar aqui é alto nos dois sentidos (quem pula não configura a empresa), e
com 88% de conclusão medida o assistente **não é** o gargalo — por isso ficou
de fora do corte de alto impacto.

### M2. O checklist pede configuração antes de valor

**Problema.** A ordem dos cinco passos é: configurar a empresa, funil pronto,
cadastrar o primeiro contato, criar o primeiro negócio, agendar a primeira
tarefa. O rodapé anuncia "próximo: configurar a empresa".

**Evidência.** `lib/onboarding/checklist.ts:39-69`, e o rótulo lido na tela.

O primeiro passo sugerido é trabalho administrativo (nome, segmento, dados de
contato) que não devolve nada. O passo que faz o produto valer alguma coisa é
o terceiro.

**Recomendação — não implementada.** Inverter a ordem, pondo "cadastrar o
primeiro contato" como próximo passo, e deixar a configuração da empresa por
último. Fica de fora do corte porque muda a ordem de um fluxo que já tem
comportamento medido, e merece ser observada antes.

### M3. O passo de escolha do assistente não tem hierarquia

**Problema.** No passo 2, onze opções de segmento (Clínica, Academia,
Restaurante, Imobiliária, Agência, Loja, Prestador de serviços, Tecnologia,
Educação, Consultoria, Outro) aparecem como onze botões idênticos.

**Evidência.** Radiografado na tela: `primaria (NENHUMA)`. Nada indica por
onde começar, e "Outro" tem o mesmo peso visual de todas as outras.

**Recomendação — não implementada.** Agrupar por afinidade ou reduzir a lista,
com "Outro" visualmente subordinado.

### M4. A retomada do assistente devolve ao passo já respondido

**Problema.** Quem sai no meio volta no passo que **acabou de responder**, não
no seguinte.

**Evidência.** `salvarPasso` (`lib/onboarding/actions.ts:104`) grava
`etapa` com a etapa **atual**, e é ela que a retomada lê.

**Ressalva de método:** a primeira leitura deste achado foi errada. Vendo
`etapa: null` em 49 de 49 registros, cheguei a anotar que a etapa nunca era
gravada. Não é: `null` é o estado final normal, escrito ao concluir
(linha 199) e ao pular (linha 331). Ninguém está no meio agora, e por isso a
coluna está vazia — o que não invalida o defeito, só o torna raro.

**Recomendação — não implementada.** Gravar a etapa seguinte, ou retomar em
`etapa + 1`.

### M5. Alvos de toque abaixo do mínimo

**Evidência.** 17 elementos clicáveis com menos de 44px de altura em
`/dashboard` a 1440px, e 12 a 375px. A regra de 44px já foi aplicada em
`select.tsx`, `combobox.tsx` e `month-grid.tsx` em 18/08.

**Recomendação — não implementada.** Estender a mesma regra aos botões de
período e aos itens do checklist. Parte deles some com a correção A1.

---

## COMUNICAÇÃO DA DOR

### D1. A dor que a landing vende desaparece assim que a pessoa entra

**Problema.** A landing inteira é construída sobre *"O WhatsApp guarda a
conversa. Não guarda o cliente."* Dentro do produto, nenhuma tela retoma essa
ideia. As descrições explicam o que a tela **é**, não o que ela **resolve**.

**Evidência.** As quatro descrições, lidas na tela:

```
/dashboard  "Quanto entrou, quanto esta em jogo e o que virou venda."
/kanban     "Cada negocio, do primeiro contato ao fechamento."
/leads      "Busque, filtre e acompanhe seus contatos."
/hoje       "O que precisa da sua atencao, por prazo."
```

São descrições corretas de funcionalidade. Nenhuma diz por que aquilo importa
para quem vende pelo WhatsApp e perde o cliente quando o vendedor sai.

O único estado vazio que chega perto é o de `/hoje`: *"Assim que você tiver um
contato aqui, o Velo Funil passa a avisar com quem falar cada dia."* Esse
texto promete um resultado, e é o melhor da varredura.

**Consequência.** A pessoa que chega por anúncio reconhece a dor na landing,
entra, e encontra um sistema de cadastro. A promessa não é renegada — ela
simplesmente para de ser dita, exatamente no momento em que a pessoa está
decidindo se vale o trabalho de alimentar mais uma ferramenta.

**Recomendação — não implementada.** As descrições de tela seguirem o padrão
que `/hoje` já usa no estado vazio: dizer o que a tela devolve, não o que ela
mostra. Ficou fora do corte por ser mudança de copy em quatro telas, que
merece decisão do dono e não correção técnica.

---

## BAIXO

### B1. `/leads` repete as duas ações

O cabeçalho traz "Novo contato" e "Importar planilha"; o estado vazio, logo
abaixo, traz os mesmos dois. Medido: `primaria Novo contato | Novo contato`.
Não impede nada — duplica a decisão numa tela que tem só duas saídas.

---

## O que foi implementado nesta rodada

```
A1  exportar e filtro de periodo somem quando nao ha dado
A2  o checklist fechado ganhou porta de volta
A3  /hoje passou a dizer "contato", como o resto do produto
```

Travado por `lib/onboarding/porta-de-volta.test.ts`, 5 testes. **Controle
negativo:** reintroduzidos os dois defeitos, 2 reprovam; restaurados, 5
passam. Sem isso o verde não provaria que os testes alcançam o defeito.

Quatro portões limpos: `tsc`, `lint`, `npm test` e `build:check`.

## O que ficou, na ordem que eu atacaria

```
1  D1   as descricoes de tela dizerem o que a tela devolve      copy, 4 telas
2  M2   o checklist pedir o contato antes da configuracao       1 arquivo
3  M5   alvos de toque abaixo de 44px                           CSS
4  M4   a retomada do assistente voltar ao passo seguinte       1 linha
5  M3   hierarquia no passo de escolha do assistente            layout
6  M1   liberar o produto durante o assistente                  decisao de produto
7  B1   duplicacao das acoes em /leads                          layout
```

Os dois primeiros são os que mais mexem no número que abre este documento.

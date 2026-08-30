# A dor de mercado, e o que ela pede

Documento de decisão. Escrito em 29/08/2026 a pedido do dono: achar uma dor
**comprovada** do público do Velo Funil e propor a solução que responde a ela,
sem escolher pelo que parece melhor.

**Mercado:** micro e pequena empresa brasileira de serviço que vende por
WhatsApp. **Região:** Brasil. **Candidatas analisadas:** 5. **Selecionada:** 1.

Cada afirmação abaixo está atrelada à evidência que a sustenta. O que não pôde
ser comprovado está marcado como **[NÃO COMPROVADO]** e não foi usado como
critério de escolha.

---

## As cinco candidatas, e por que quatro caíram

| # | dor candidata | evidência que tem | por que não foi escolhida |
|---|---|---|---|
| 1 | **Encher o CRM na mão** | banco + publicada + reclamação + demanda | **selecionada** — única com as 4 classes convergindo |
| 2 | Vendedor sai e leva a carteira | nenhuma medida nesta rodada | ver ressalva abaixo |
| 3 | Demora para responder o cliente | publicada forte | é dor de atendimento, não de CRM; o banco não a mede |
| 4 | Negócio para sem próxima ação | banco forte | é **consequência** da nº 1, não causa independente |
| 5 | Não sabe quanto tem para fechar | nenhuma direta | nenhuma evidência levantada a sustenta |

**Sobre a nº 2, dita na cara:** ela está registrada no `estado-atual.md` desde
21/08 como achado de pesquisa e virou promessa da landing ("O histórico fica
com a empresa"). **Nesta rodada não levantei nenhuma evidência dela** — nem no
banco nem fora. Isso não a torna falsa; torna-a não comprovada aqui. E há um
sinal contrário que precisa ser dito: as empresas externas da base têm 1 a 2
pessoas, e empresa de uma pessoa só não tem vendedor para sair.

**Sobre a nº 4:** 55 de 70 negócios do banco não têm nenhuma próxima ação, e
21 de 70 nunca mudaram de etapa. É evidência real e forte. Não foi escolhida
porque um negócio sem próxima ação é o que acontece **depois** de ninguém
alimentar o sistema — tratá-la como dor separada seria atacar o sintoma.

---

## A dor selecionada: o custo de pôr o dado dentro

### Evidência 1 — comportamento no banco de produção (a mais forte, e a mais limitada)

Lido em 29/08/2026 do banco real, com contas de teste e do dono excluídas pela
regra de `lib/dono/ativacao.ts`:

```
empresas no banco        38
externas (nao teste)     23   <- a base desta leitura

criou conta              23  100%
concluiu onboarding      22   96%
1o contato                9   39%   <- PERDE 13 de 22 num degrau so
1o negocio                7   30%
criou tarefa              5   22%
conectou canal            0    0%
```

**A queda não está na entrada.** 96% concluem o onboarding, 74% respondem o
assistente de 4 perguntas e 65% completam o tour. As pessoas entendem o
produto e passam por ele.

Elas param exatamente onde precisam **digitar o primeiro cliente**.

E das 9 que passaram desse degrau, o padrão de volta é pior que a queda:

```
6 de 9 usaram por 0 dia    tudo no mesmo dia em que criaram a conta,
                           e nunca mais voltaram
```

Só uma (Fani RRH) usou por mais de 9 dias. Todas estão paradas há 2 a 27 dias.

**Limite desta evidência, dito antes de qualquer conclusão:** 23 empresas, das
quais 9 passaram do primeiro degrau. **Não há significância estatística
nenhuma nisso.** É sinal de direção, não prova de proporção — e a proporção
exata (39%) não deve ser citada como se fosse taxa estável.

### Evidência 2 — pesquisa publicada

O custo de alimentar CRM está medido fora daqui, com amostra que este projeto
não tem:

- Vendedores gastam em média **3,4 horas por semana** digitando informação de
  cliente no CRM; **32%** gastam mais de uma hora por dia com entrada manual
  ([EverReady](https://everready.ai/13-statistics-for-crm-data-entry-automation/)).
- **23%** dos usuários apontam a entrada manual de dados como obstáculo
  principal (mesma fonte).
- **Cerca de 55%** das implantações de CRM não atingem o objetivo planejado, e
  **mais de 60%** das falhas vêm de adoção pelo usuário — contra 6-10%
  causadas pela plataforma em si
  ([LOW/CODE](https://www.lowcode.agency/blog/crm-implementation-failure-rate)).

A última linha é a que importa para a escolha: **o CRM não falha por ser ruim,
falha porque ninguém o alimenta.** É o mesmo desenho que o banco mostra aqui.

### Evidência 3 — reclamação pública, com as palavras de quem sente

A aritmética que os usuários fazem, e que nenhuma pesquisa formaliza:

> "O SDR que atende 40 conversas por dia no WhatsApp Business não tem 15
> minutos livres para transcrever o que acabou de acontecer em cada uma. Cada
> vez que uma conversa avança e o vendedor precisa atualizar a etapa,
> registrar o histórico e salvar, são no mínimo três minutos. Multiplicados
> por 30 interações diárias, **90 minutos de trabalho administrativo por
> vendedor, todos os dias**."
> — [Clint](https://www.clint.digital/blog/equipe-abandonar-crm-como-resolver-2026)

Análises brasileiras do mesmo problema convergem em "silos de informação" e
"digitar os mesmos dados várias vezes" como causa direta de abandono
([Ploomes](https://blog.ploomes.com/baixa-adesao-ao-crm/),
[Onflag](https://www.onflag.com.br/processo-comercial/dificuldades-usar-crm-como-resolver)).

### Evidência 4 — demanda declarada pelo mercado

- **82%** dos pequenos negócios brasileiros usam o WhatsApp para vender e se
  comunicar com clientes — 12ª Pesquisa Pulso do Sebrae, 8,2 mil
  empreendedores ouvidos entre fevereiro e março de 2026
  ([Agência Sebrae](https://agenciasebrae.com.br/dados/whatsapp-se-consolida-nas-vendas-on-line-enquanto-facebook-e-lojas-proprias-perdem-folego/)).
- **79%** dos times de vendas no Brasil prospectam via WhatsApp
  ([SocialHub](https://www.socialhub.pro/blog/whatsapp-pequenas-empresas-2026/)).
- Pelo menos **dez** CRMs brasileiros competem hoje na categoria "CRM para
  WhatsApp" — Moskit, PipeRun, RD Station, RMChat e outros
  ([Agendor](https://www.agendor.com.br/blog/crm-para-whatsapp/)).

Dez concorrentes disputando a mesma categoria é evidência de demanda: ninguém
constrói e mantém produto para dor que não existe.

**[NÃO COMPROVADO]** Volume de busca. Afirmar "N mil buscas por mês por CRM
para WhatsApp" exigiria Keyword Planner ou equivalente, que não foi consultado
nesta rodada. A demanda está sustentada pela existência dos concorrentes e
pelos percentuais de uso, não por volume medido.

### O que as quatro evidências dizem juntas

A pessoa que vende por WhatsApp (82%) precisa transcrever a conversa para o
CRM (3 min por interação, 90 min/dia), não faz isso (23% apontam como
obstáculo, 3,4h/semana quando fazem), e o CRM morre por adoção (55% falham,
60% por usuário). No Velo Funil isso aparece como 13 de 22 empresas parando no
degrau de cadastrar o primeiro contato, e 6 de 9 nunca voltando depois do
primeiro dia.

**A dor não é "falta um CRM". É que todo CRM cobra um pedágio de digitação que
quem vende pelo WhatsApp não tem como pagar.**

---

## A solução: o contato entra sem ninguém digitar

A solução responde ao degrau exato onde a evidência mostra a perda — **criar o
primeiro contato** — e elimina dele a única coisa que custa: digitar.

### O que se propõe

**Aceitar a conversa exportada do WhatsApp como fonte de contato.**

O WhatsApp tem uma função nativa, em todo aparelho, sem API e sem integração:
*Exportar conversa*, que gera um `.txt` com o histórico e o número. O produto
passa a aceitar esse arquivo e dele extrai:

```
nome e telefone      ->  contato
o que foi pedido     ->  negocio, na etapa que a conversa indica
a ultima mensagem    ->  atividade no historico
quem falou por ultimo ->  proxima acao, com prazo
```

Uma ação, zero digitação, e o funil nasce preenchido em vez de vazio.

### Por que esta solução, e não a óbvia

A resposta óbvia é integrar a API oficial do WhatsApp. **Ela está fora de
alcance hoje, e isso foi medido nesta mesma sessão**, não suposto:

```
codigo que publica/le WhatsApp por API oficial   0 arquivos
credencial de Instagram/WhatsApp no .env.local   nenhuma
META_ADS_TOKEN                                   "API access blocked" (HTTP 400)
contas ligadas a conta de anuncio                0
```

Antes da API oficial ainda vêm verificação de negócio, App Review de dois
escopos e uma WABA — semanas, e cada cliente teria de fazer a própria
verificação. A conversa exportada não depende de nada disso: funciona hoje,
em qualquer aparelho, para qualquer cliente.

### Por que ela cabe neste produto

O caminho de importar arquivo **já existe e está em produção** desde 11/08:
`.xlsx` e `.csv`, com mapeamento de coluna, deduplicação e criação de negócio
junto do contato. O que muda é o *parser* de entrada, não a arquitetura.

E ela fecha um buraco que a própria landing abriu: a repositionagem de 24/08
trocou o inimigo da planilha para o WhatsApp justamente porque **quem vende
por WhatsApp não tem planilha para importar**. A página passou a falar com
esse público, e o produto continuou oferecendo só o caminho da planilha. A
conversa exportada é o "traga o que você já tem" para quem não tem planilha.

### A ligação, ponto a ponto

| evidência | o que ela mostra | o que a solução faz |
|---|---|---|
| 13 de 22 param no 1º contato | o pedágio é digitar o primeiro cliente | o primeiro contato entra de um arquivo |
| 3,4h/semana, 90 min/dia | transcrever conversa é o custo | não há transcrição |
| 55% falham, 60% por adoção | CRM morre sem alimentação | o funil nasce cheio |
| 82% vendem por WhatsApp | o dado já existe, no WhatsApp | é de lá que ele é lido |
| 6 de 9 usaram por 0 dia | não há motivo para voltar no dia 2 | com funil cheio, existe o que fazer |

---

## O que este documento NÃO prova

Registrado com o mesmo peso do resto, porque documento que só afirma é
propaganda:

1. **A causa do abandono é inferida, não confirmada.** O banco mostra ONDE as
   pessoas param. Ele não diz POR QUÊ. Nenhuma das 23 empresas foi
   perguntada. A explicação "o custo é digitar" é a que as outras três
   evidências sustentam, e continua sendo uma inferência até alguém falar com
   um desses usuários. **É o próximo passo mais barato e mais valioso deste
   documento** — cinco conversas de dez minutos valem mais que esta página.

2. **A base é pequena demais para taxa.** 23 empresas externas, 9 além do
   primeiro degrau. Direção, não proporção.

3. **A solução não foi testada.** Nenhuma linha foi escrita, nenhum `.txt` de
   conversa real foi processado. O formato de exportação do WhatsApp varia por
   idioma, sistema e versão, e isso precisa ser verificado contra arquivos
   reais antes de qualquer estimativa de prazo.

4. **Volume de busca não medido**, como já registrado acima.

5. **A dor nº 2 (carteira que vai embora) não foi comprovada nesta rodada**, e
   ela sustenta uma promessa que hoje está no ar na landing.

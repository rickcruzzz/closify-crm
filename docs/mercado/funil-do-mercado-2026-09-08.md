# Como o mercado brasileiro de CRM deixa alguém entrar (08/09/2026)

Pedido do dono: *"no mercado de CRM, o funil, o que fecha e o que não fecha,
usando a API do Exa"* — com o objetivo declarado de lucro forte no curto e no
longo prazo.

Rodado com a API do Exa: **3 chamadas, US$ 0,12**, sobre 18 domínios com preço
publicado. Lidas a página inicial e as de preço/planos de cada um, 12.000
caracteres por página.

---

## A fronteira, e ela decide o que este documento vale

```
PODE ser medido   a FORMA do funil: teste ou demo, pede cartao ou nao,
                  quantos dias, tem plano gratis, cobra implantacao
NAO PODE          a TAXA de fechamento de cada um. Ninguem publica funil real,
                  e "benchmark de SaaS" de blog e numero sem amostra e sem
                  metodo — o tipo de dado que este projeto ja registrou como
                  produtor de conclusao errada
```

Então o que segue é a **anatomia** do funil do mercado, não o desempenho dele.
A anatomia é suficiente para decidir onde nos diferenciar; o desempenho, não.

### Uma correção de método, dentro da própria rodada

A primeira passagem usou `maxCharacters: 3000` e produziu **zeros em bloco**:
onze dos dezoito domínios apareceram sem nenhum sinal. Era artefato — vários
textos pararam exatamente em 3.000 caracteres, e a regra do teste costuma ficar
depois disso, na página de preços.

Com 12.000 caracteres e mais caminhos (`/precos`, `/planos`, `/preco`,
`/pricing`), os 18 passaram a ter texto e a contagem mudou de 7 para 11 em
"teste self-serve". **A leitura truncada não erra para menos de forma visível —
ela devolve zero, que parece medição.**

---

## [MEDIDO] A porta de entrada, 18 de 18

```
teste self-serve      11 de 18   (61%)
pede demo/vendas       6 de 18   (33%)
diz "sem cartao"       8 de 18   (44%)
tem plano gratis       5 de 18   (28%)
cobra implantacao      1 de 18   (6%)
menciona fidelidade    4 de 18   (22%)
```

### A duração do teste é quase uma convenção

```
 7 dias   clixx, meets, nexxou, upgestao, nooma, unicocrm    6 de 8
10 dias   rdstation
14 dias   leads360
```

**Sete dias é o padrão do mercado brasileiro de CRM.** Isso não é opinião: é o
que oito páginas de preço declaram, e seis delas dizem o mesmo número.

---

## O que isso diz sobre o NOSSO funil

### 1. Ser self-serve não nos diferencia

61% já são. Entrar sem falar com vendedor é o padrão, não a vantagem. Qualquer
copy que venda "sem precisar falar com vendedor" está gastando espaço com o que
o concorrente também faz.

**O que sobra como diferença real é o outro lado:** 33% exigem demonstração — e
esses são justamente os de ticket alto. Para quem chegou de uma busca de preço,
"agende uma demonstração" é atrito no pior momento. É contra esses que a nossa
entrada compete de verdade.

### 2. O achado principal: 6 de 8 testes acabam em PAREDÃO — e nós não temos teste

O número que mais importa da rodada só aparece cruzando duas colunas — prazo de
teste **e** plano grátis:

```
com prazo declarado          8   clixx, meets, rdstation, nexxou, upgestao,
                                 leads360, nooma, unicocrm
com plano gratis             5   agendor, meets, akio, rdstation, bitrix24
trial E free (sem paredao)   2   meets, rdstation
trial que acaba em PAREDAO   6   clixx, nexxou, upgestao, leads360,
                                 nooma, unicocrm
```

**Seis de oito CRMs deste mercado dão sete dias e depois fecham a porta.** No
oitavo dia a pessoa perde o acesso ao que cadastrou — e o que ela cadastrou é a
carteira de clientes dela.

#### Uma correção minha, e ela inverte metade da conclusão

Eu escrevi que o Velo Funil tinha os dois — trial de sete dias e queda para o
Free. **É falso, e o dono desmentiu.** Conferido no código e no banco:

    migration 0057 (29/08)   "empresa nova deixa de nascer com 7 dias de Pro"
    o insert                 (name, created_by) — sem `trial_ate`
    banco, 7 workspaces
    criados apos 29/08       NENHUM nasceu com trial
    a landing                zero mencao a teste ou prazo, conferido em producao

A máquina do trial continua de pé (`em_trial()`, os e-mails, a tela
`/dono/trial`) porque arrancá-la de 43 arquivos quebraria a promessa das cinco
empresas que estavam em avaliação na época. Mas **ninguém mais nasce com ela**.

O erro é da mesma família que este projeto já registrou várias vezes: li
`lib/dono/trial.ts` dizendo *"o trial é uma janela de sete dias"* e concluí que
o trial existia. O arquivo está certo — ele descreve como a janela FUNCIONA para
quem tem uma. Nenhuma linha dele diz que alguém ainda ganha uma.

#### A posição real, e ela é mais extrema do que eu tinha escrito

```
o mercado    8 de 18 dao um gostinho de TUDO por 7 dias, e 6 desses
             fecham a porta no oitavo
nos          nao damos gostinho nenhum. Damos 50 contatos, para sempre
```

Isso troca a força e a fraqueza de lugar, e as duas ficam maiores:

**A favor:** ninguém é cortado, nunca. Não existe oitavo dia. Numa categoria
onde o valor aparece depois de cadastrar contato e marcar follow-up — semanas,
não dias —, o prazo do concorrente expira antes de a pessoa descobrir para que
serve. Aqui ela descobre no ritmo dela.

**Contra, e é o problema comercial de verdade:** **ninguém nunca experimenta o
Pro.** O concorrente mostra tudo e tira; nós nunca mostramos. Os gatilhos de
upgrade que sobram são apenas dois, e ambos são de escassez, não de desejo:

```
bater nos 50 contatos              teto do Free
querer Google Calendar / Gmail     integracoes, que sao Pro
```

Quem não chega a 50 contatos e não usa Google **não tem nenhum motivo para
assinar**, porque nunca viu o que está do outro lado. É a explicação estrutural
mais provável para zero conversões de Free para Pro até hoje — e é uma hipótese
com correção barata, não uma sentença.

### 3. A fidelidade é minoria, e a objeção continua valendo

Só 22% mencionam fidelidade ou contrato mínimo. Ou seja: **"sem fidelidade" não
é raro** — é comum e simplesmente não é dito.

Isso reposiciona o eixo de copy de 07/09. A vantagem não é não ter fidelidade;
é **dizer** que não tem, num mercado onde 0 de 17 fala de cancelamento na página
inicial (medido em 07/09). Continua sendo território vazio — mas por omissão do
mercado, não por prática dele.

---

## [NÃO PROVADO] Tudo que decide receita

```
qual formato de entrada converte mais    ninguem publica
7 dias vs Free-ate-50                    idem
se o nosso Free vira Pro                 zero conversoes ate hoje
quanto tempo o PME leva para ativar      o funil de ativacao existe e
                                         se recusa a opinar abaixo de 5 contas
```

Nenhuma rodada de Exa move esses quatro. Eles se movem com **volume próprio**, e
volume próprio começa em conversa.

---

## O que fazer com isto, na ordem do retorno

```
1. dar a PROVA do Pro sem dar prazo                  o buraco maior.
   Hoje ninguem nunca ve o Pro, entao o unico gatilho e bater no teto.
   O caminho que NAO reintroduz paredao: liberar o Pro no momento em
   que a pessoa faria a acao (ligar a agenda, mandar o e-mail), uma vez,
   e mostrar o que aconteceu. Prova sem relogio correndo

2. vender "sem prazo", nao "self-serve"              61% ja sao self-serve;
   o que 6 de 8 NAO tem e "seu acesso nao acaba". Esse argumento esta
   AUSENTE da landing hoje, e agora e literalmente verdade: nao ha
   sequer um oitavo dia

3. "sem fidelidade" continua na copy                 territorio vazio por
   omissao do mercado, e ja esta no ar desde 07/09

4. a conversa continua sendo o unico caminho para as 4 perguntas nao
   provadas acima
```

---

## O método, para a próxima rodada

```
truncar mente em silencio    3.000 caracteres devolveram 11 falsos zeros,
                             e zero parece medicao
caminho adivinhado falha     /precos existe em uns, /planos em outros;
                             pedir os dois custa quase nada e cobre os dois
100 URLs e o teto            o Exa recusa lote maior, com 400
publicado != praticado       desconto de vendedor e prazo estendido nao
                             estao em pagina nenhuma
```

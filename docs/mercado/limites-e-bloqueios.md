# Prospecção agressiva sem tomar bloqueio (06/09/2026)

Pedido do dono: *"seja brutal, mas sempre com cautela, apenas não tomar
bloqueio"*. Este documento é a resposta — o que pode ser levado ao máximo, o
que tem teto duro, e onde o bloqueio realmente mora.

**O princípio que organiza tudo:** o volume é livre na DESCOBERTA e caro na
ENTREGA. Descobrir dez mil empresas custa dólares e não incomoda ninguém.
Mandar mensagem para dez mil queima o número, o domínio e a marca.

---

## 1. WhatsApp — o único bloqueio que mata a operação

O número do dono é o ativo. Banido, some o canal de venda **e** o canal de
suporte do produto ao mesmo tempo.

O que faz banir, na ordem de gravidade:

    denuncia de spam        o usuario aperta "Bloquear e denunciar". Poucas
                            denuncias em pouco tempo derrubam
    volume subito           conta nova disparando dezenas de mensagens para
                            numeros que nunca falaram com ela
    texto identico          a mesma string para centenas de destinos e o padrao
                            mais facil de detectar
    zero resposta           conversas onde ninguem responde sinalizam frio

**As travas que este projeto adota, e onde cada uma vive no código:**

`lib/inteligencia-de-mercado/dominio/abordagem.ts` **não envia nada.** Devolve
texto. O `--mensagem` imprime um link `wa.me` com o texto pronto; quem aperta
enviar é uma pessoa. Não construir enviador automático é decisão, não pendência.

A linha de descarte sai na **primeira** mensagem, e nunca é cortada — tem teste.
Ela transforma "não tenho interesse" em resposta em vez de denúncia. Um defeito
real já comeu essa linha por truncamento, e o teste de tamanho não pegava.

`scripts/inteligencia/nao-perturbe.txt` é lido a cada rodada. Sem ele, a
promessa *"me avisa que não te procuro de novo"* seria mentira na rodada
seguinte — e a segunda abordagem depois de um "não" é exatamente o que vira
denúncia.

**Ritmo, que é do dono e não do código:** mensagens espaçadas, em horário
comercial, e responder quem responde. Uma conversa real por hora vale mais que
cem disparos.

---

## 2. E-mail — o risco silencioso, e o mais fácil de cometer

**Nunca disparar prospecção fria de `velofunil.com.br`.**

Esse domínio manda recuperação de senha, convite de colaborador e aviso de
cobrança pelo Resend. Reputação de domínio é única: uma campanha fria com taxa
de reclamação alta joga o domínio inteiro em filtro de spam, e a partir daí
**o cliente que esqueceu a senha não consegue mais entrar no produto.**

O estrago não aparece como bloqueio. Aparece como suporte reclamando que o
e-mail não chega — e a causa estaria a semanas de distância.

Se um dia houver e-mail frio: domínio separado, aquecimento, e nunca a mesma
credencial do transacional.

---

## 3. LGPD — o que sustenta a abordagem, e o que não sustenta

Contato corporativo publicado pela própria empresa no próprio site, usado para
oferta B2B pertinente ao negócio dela, cabe em **legítimo interesse**
(Art. 7º, IX). O que a lei cobra em troca, e a mensagem já entrega:

    identificacao       quem esta falando
    origem do dado      "achei procurando empresas do setor no Google"
    oposicao facil      a linha de descarte, na primeira mensagem
    registro do "nao"   nao-perturbe.txt, lido antes de cada rodada

**O que NÃO cabe, e fica registrado para não ser tentado:** dado de pessoa
física sem vínculo comercial, contato raspado de perfil pessoal, e qualquer
lista comprada. A recusa do Gatilho 2 no plano original (mostrar lead minerado
dentro do funil do cliente) segue valendo inteira e pelo mesmo motivo.

---

## 4. LinkedIn — ler é seguro, agir não é

`category: 'linkedin profile'` no Exa devolve o nome do decisor a partir do
índice **deles** — nós não raspamos nada, e isso é leitura de conteúdo público.
Medido em 06/09: a busca por sócio-proprietário de comunicação visual devolveu
nome e empresa de seis pessoas.

**O bloqueio mora na outra ponta:** automatizar convite, mensagem ou visita de
perfil dentro do LinkedIn é o que derruba conta, e derruba rápido. Usar o nome
para ligar e pedir a pessoa certa é o uso seguro.

---

## 5. Exa — teto de gasto, não de bloqueio

Não há risco de banimento; há risco de **conta zerada**. `dominio/orcamento.ts`
tem teto mensal em centavos e `--teto` limita chamadas por rodada.

Custos medidos em 06/09, para dimensionar:

    search                        ~US$ 0,0196 por chamada
    numResults 10 -> 50           MESMO preco, 4x os dominios
    rodada de 1 nicho, 5 cidades  ~US$ 0,25, devolve ~90 prospects

O `numResults: 50` é a alavanca mais barata que existe aqui: pedir 10 estava
jogando fora quatro quintos da colheita pelo mesmo dinheiro.

---

## 6. O teto honesto de tudo isto

A lista não fecha venda. Ela ordena quem ligar primeiro.

Com 90 prospects de dedetização, taxa de resposta de prospecção fria B2B fica
entre 5% e 15% quando a mensagem é personalizada e o produto é barato — o que
dá 5 a 13 conversas, e uma fração disso vira pagante. **Este produto nunca teve
um cliente externo**, então nem essa faixa está validada aqui.

O que aumenta a conta não é mais volume: é responder rápido quem responde.

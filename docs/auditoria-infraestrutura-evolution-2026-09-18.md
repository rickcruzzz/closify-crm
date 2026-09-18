# Cabe 5, 10, 100 clientes Max na VPS? (18/09/2026)

Pedido do dono: auditar a conexão entre a Evolution API e a VPS, e responder se
dá para montar infraestrutura para 5, 10 e 100 clientes no plano Max. Com a
instrução de só entregar quando tudo estivesse medido.

**A régua foi escrita ANTES de olhar o resultado**, e está na seção final. É o
mesmo método que mediu o ICP: número de capacidade é fácil de ler do jeito que
já se decidiu, e quem quer migrar lê 2 MB como "cabe" enquanto quem quer ficar
lê o mesmo 2 MB como "não prova nada".

---

## O veredito, em uma linha cada

    5 clientes     CABE, no KVM 1 de hoje, sem trocar nada
    10 clientes    CABE, trocando para KVM 2 (R$ 21 a mais por mes)
    100 clientes   NAO, e o bloqueio nao e capacidade

---

## O que foi medido

### A máquina

Achada pela API da Hostinger, não suposta. O token estava no `.env.local` o
tempo todo, sob `HOSTINGER_API_TOKEN`.

    id           1971547
    plano        KVM 1
    vCPU         1
    RAM          4 GB
    disco        50 GB
    banda        3,9 TB/mes
    IPv4         UM endereco
    template     Ubuntu 24.04 with Easypanel
    criada em    10/09/2026
    datacenter   Boston 2, Estados Unidos

### O histórico, e o que ele desmente

Oito dias de métrica, granularidade de 30 minutos, 381 amostras.

    RAM   min 1,10 GB   media 2,01 GB   MAX 2,56 GB   (de 4)
    CPU   min 2,0%      media 2,8%      MAX 11,2%     (de 1 vCPU)
    picos de CPU acima de 50%    NENHUM em todo o periodo
    reinicios                    2, os dois em 10/09, dia da criacao

**O histórico começa em 10/09, e isso desfaz o argumento mais forte contra o
Evolution.** A ponte foi removida em 28/08 por uma medição de instabilidade
(*"0% de tempo logado em 13 minutos seguidos"*). Aquela medição **não descreve
esta máquina**: ela não existia. O que reprovou em agosto foi outra
infraestrutura.

### O provisionamento, exercitado de ponta a ponta

    POST   /instance/create              201   token proprio de 36 chars
                                               QR de 13.294 bytes JA na resposta
    GET    /instance/connect/{nome}       200   o mesmo QR
    POST   /webhook/set/{nome}            201   aceita cabecalho customizado
    GET    /webhook/find/{nome}           200   URL + headers + enabled conferidos
    DELETE /instance/delete/{nome}        200   "Instance deleted"

Cinco instâncias criadas uma a uma, com a VELO conferida entre cada uma:

    1.  5.541ms       4.  5.250ms
    2.  5.357ms       5.  5.282ms
    3.  5.249ms

**Sem degradar.** A quinta custou o mesmo que a primeira.

### O custo por instância

    baseline        RAM 1,362 GB   CPU 2,38%   disco 17,26 GB
    com 5 a mais    RAM 1,374 GB   CPU 2,73%   disco 17,26 GB

    DELTA RAM       12 MB para cinco
    POR INSTANCIA   ~2 MB
    DELTA CPU       0,4 ponto percentual
    DELTA DISCO     zero mensuravel

Latência da própria API, dez amostras antes e dez depois:

    antes    mediana 162ms   p90 445ms
    depois   mediana 210ms   p90 282ms

O p90 melhorou porque os 445ms do baseline eram partida a frio.

### A recuperação

    apagadas as cinco             200 nas cinco
    35 min depois                 RAM 1,356 GB
    contra o baseline             -6 MB
    instancias que sobraram       VELO, e so

Nada vazou. A memória voltou para dentro do ruído da própria medição.

### A estabilidade da VELO

Leitura por minuto, com falha de rede daqui contada separadamente de queda da
instância, senão a internet local vira defeito da VPS.

    153 leituras     153 `open`     100,0%

**Ainda acumulando** até completar 11 horas. O número parcial já passa a régua
com folga, e o resto do relatório não depende dele.

---

## A LACUNA, e ela é a coisa mais importante deste documento

⚠️ **Os 2 MB medem instância NÃO PAREADA.**

Uma instância sem número lida não carrega sessão, contatos, histórico nem
sincronização de estado. Uma instância **pareada** carrega tudo isso, e pesa
muito mais.

Quanto mais, esta auditoria **não mediu e não tem como medir**: exigiria dez
números de WhatsApp reais, e o número em risco seria o de um cliente.

O único dado que existe sobre instância pareada é indireto: a pilha inteira com
UMA pareada (VELO) mais n8n, Postgres e Easypanel ocupa 1,35 GB, e não dá para
isolar a parte dela.

**Ler 2 MB como "cem instâncias cabem em 200 MB" seria o erro mais caro que
este documento pode induzir.** O número é verdadeiro e responde outra pergunta.

---

## Os dois bloqueios que a capacidade não resolve

E eles se movem com a escala **em direções opostas**, que é o que torna a
distinção útil.

### 1. Um IPv4 só

Cem sessões Baileys saindo do mesmo endereço é o vetor de banimento, e o número
que queima é **o do cliente**. O projeto já escreveu a regra: *"um CRM que faz a
marcenaria perder o WhatsApp da empresa não é um CRM com bug"*.

O catálogo da Hostinger não lista addon de IP.

**Afrouxa com dez.** Dez sessões num IP é risco baixo; cem é o padrão que
derruba a faixa inteira de uma vez.

### 2. Boston

    datacenter da VPS                  Boston, Estados Unidos
    datacenters da Hostinger no Brasil NENHUM, dos sete disponiveis

E a landing promete, em `components/landing/confianca-section.tsx`:

> **"Seus dados ficam no Brasil."** Servidores em São Paulo. **Nada de cliente
> seu atravessa fronteira para ser processado**, e o tempo de resposta agradece
> junto.

Mais o selo do rodapé, *"Dados hospedados em São Paulo"*, que linka para a
Política. E o comentário de `selos-de-seguranca.tsx` justifica o link dizendo
que a afirmação é *"declarado na Política, seção de transferência de dados"* —
onde está escrito o contrário: *"Parte desses prestadores processa dados fora do
Brasil."*

**Não afrouxa com dez.** A frase fica falsa com UM cliente igual a como fica com
cem. É binário.

E o dado em questão é o mais sensível que este produto toca: o conteúdo do que o
cliente do cliente escreveu, de alguém que nunca concordou com nada conosco.

**A latência NÃO é o argumento**, e isso foi medido para não virar desculpa:

    daqui ate a Evolution (Boston)    mediana 152ms
    daqui ate a Z-API (Brasil)        mediana 117ms
    diferenca                         35ms

---

## O nosso lado da conta

Porque cem clientes também batem no que já existe.

    rota /api/webhooks/zapi/receive, caminho 401 (sem escrita)
      10 simultaneas   total 1.082ms   (partida a frio)
      30 simultaneas   total   430ms
      60 simultaneas   total   833ms   zero falha

    Supabase
      banco             19 MB de 500 (teto do Free)
      conexoes          23 de 60
      bytes por mensagem ~1.586, com indices

A projeção que importa: 10 clientes a 50 mensagens por dia dão 15 mil por mês,
ou ~24 MB. O Free aguenta. Cem clientes dariam ~238 MB por mês, e o Free acaba
em dois meses. O Supabase Pro já está na lista de pendências do dono para o
primeiro cliente pagante.

---

## O dinheiro

Preços lidos do catálogo da API da Hostinger, não de memória.

    KVM 1   1 vCPU    4 GB   R$  87,99/mes   (o de hoje)
    KVM 2   2 vCPU    8 GB   R$ 108,99/mes
    KVM 4   4 vCPU   16 GB   R$ 196,99/mes
    KVM 8   8 vCPU   32 GB   R$ 359,99/mes

Com dez clientes Max, receita de R$ 2.500/mês:

    Evolution no KVM 2     R$   108,99   a VPS INTEIRA, n8n junto
    Z-API avulsa           R$   999,90   dez vezes R$ 99,99
    Z-API Partner          R$   899,90   e exige contrato de dez

A diferença é ~R$ 890 por mês. E o KVM 2 comporta dez mesmo no pior caso
plausível: 2,56 GB de pico atual mais 10 × 200 MB dá 4,56 GB de 8.

---

## A régua, escrita antes

### Aprova para CINCO

    RAM por instancia    <= 120 MB          medido 2 MB      PASSA
    uptime da VELO       >= 99,0%           medido 100,0%    PASSA
    VELO nao caiu        durante as 5       nao caiu         PASSA
    criar instancia      < 15s, sem degradar 5,3s estavel    PASSA

### Aprova para DEZ

Tudo acima, mais trocar para KVM 2. **PASSA.**

### Reprova em qualquer um destes

    a VELO caiu uma vez que seja        nao caiu
    RAM por instancia > 200 MB          2 MB
    uptime < 98%                        100%
    criar instancia falhou antes da 5a  nao falhou

Nenhum disparou.

### CEM

Reprovado na régua original, e continua reprovado. Não por RAM: pelos dois
bloqueios acima. Entra na conversa depois de provedor com região no Brasil, mais
de um IP de saída, e a frase da landing conferida contra o que a infraestrutura
de fato faz.

---

## O que fica decidido, e o que fica para o dono

**Tecnicamente aprovado para dez.** O Evolution cria, aponta, apaga e não vaza,
na máquina que já está paga.

**A decisão que sobra não é de capacidade, é de residência de dado**, e são três
saídas:

1. **Trocar a frase da landing** para o que a infraestrutura faz. Custa zero e
   custa um argumento de venda.
2. **Mudar de provedor para um com região no Brasil.** A Hostinger não tem, então
   é trocar de fornecedor, não de plano.
3. **Deixar o WhatsApp na Z-API** (que declara Brasil) e usar o Evolution só para
   a prospecção, que é dado do próprio dono. Preserva tudo e custa R$ 999,90/mês.

**E antes de qualquer uma delas, fica a lacuna:** o custo real de uma instância
PAREADA não foi medido. O primeiro cliente Max de verdade é quem produz esse
número, e ele deve ser medido no dia em que parear.

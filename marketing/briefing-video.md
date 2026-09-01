# Briefing de vídeo — Velo Funil

Você é o diretor de criação de um CRM brasileiro. O trabalho é desenhar
criativos em **vídeo** para Instagram, em dois formatos, e entregar o **script
Python** que os gera.

Este documento é auto-contido: você não vai ter o repositório. Tudo que precisa
decidir está aqui, incluindo uma tentativa anterior que foi reprovada e por
quê.

**Leia a seção 5 antes de desenhar qualquer coisa.**

---

## 1. O produto

**Velo Funil**, CRM para pequena empresa de serviço no Brasil — agência,
consultoria, clínica, imobiliária pequena. Funil de vendas em Kanban.

```
grátis    até 50 contatos, sem cartão
Pro       R$ 49 por mês, PELA EMPRESA INTEIRA, não por vendedor
site      www.velofunil.com.br
```

**O posicionamento decide o tom de tudo.** 82% da pequena empresa brasileira
vende pelo WhatsApp (Sebrae, 8,2 mil ouvidas). O produto **não compete com o
WhatsApp**: a headline da landing é *"O WhatsApp guarda a conversa. Não guarda
o cliente."*

Nunca mande a pessoa trocar de ferramenta. "Mas eu já uso WhatsApp" é a objeção
número 1 do público, e brigar com ela perde a discussão antes de começar.

**A vantagem que nenhum concorrente mapeado tem:** os outros cobram por
vendedor. Cinco pessoas a R$ 53 (mediana pública) dão R$ 265 por mês. Aqui são
R$ 49, independente de quantas pessoas.

---

## 2. O sistema visual

Estes valores saem dos tokens de cor do próprio software. É isso que faz quem
clica no vídeo e chega no produto ver a mesma marca.

```
                  REGISTRO ESCURO     REGISTRO CLARO
fundo             (4, 32, 33)         (246, 248, 249)
título            (252, 252, 252)     (10, 10, 10)
corpo             (150, 172, 172)     (94, 101, 101)
destaque          (0, 191, 192)       (0, 120, 122)
borda             (42, 46, 48)        (217, 220, 221)

Geist Variable           UltraBlack · Bold · SemiBold · Medium · Regular
Geist Mono               rótulo e unidade, nunca corpo de texto
Instrument Serif Italic  número, quando não há grafismo carregando o dado
```

O destaque muda de valor entre registros porque `#00BFC0` sobre fundo claro dá
2,1:1 e some. `(0, 120, 122)` dá 4,76:1.

**O símbolo da marca** são três camadas que convergem e formam um funil e a
letra V. Larguras 18.8 → 10.2 → 2.2, base chanfrada no mesmo ângulo. Camadas
soltas, nunca um funil sólido de peça única: o sólido lê como ícone genérico de
filtro.

---

## 3. Os formatos, e as zonas seguras que MUDAM entre eles

```
                 REELS (9:16)        FEED (4:5)
canvas           1080 x 1920         1080 x 1350
topo                220px               122px
base                500px               176px
lados               180px                97px
banda útil       720 x 1200          886 x 1052
```

No Reels, a barra de ações (curtir, comentar, compartilhar) e a pilha de
legenda ficam **por cima** do vídeo. No feed não ficam, mas a grade do perfil
recorta a peça em **3:4** — 1012×1350 centralizado, 34px somem de cada lado.

**Exportar um formato no outro é o atalho óbvio e enterra conteúdo debaixo da
interface.** A conta precisa fechar: `220 + 1200 + 500 = 1920`.

**Nada que precise ser lido pode ficar fora da banda útil.** Isso vale
principalmente para o endereço do site: Reel não tem link clicável, então o
endereço escrito é a única porta para o produto. Numa tentativa anterior ele
saiu 103px abaixo do fim da banda, ou seja, publicado e coberto.

---

## 4. As restrições que não se negociam

```
oferta         interpolada de constantes (FREE_LEAD_LIMIT = 50,
               PRO_PLAN_PRICE = 49). NUNCA escrita à mão na peça
prova social   proibida. Não existe cliente externo: 42 empresas no banco,
               37 de teste, e as 5 restantes com zero contatos. Zero
               depoimento, zero logo, zero "mais de N empresas"
promessa       nada de período de avaliação (foi removido do produto) e
 aposentada    nada de "ilimitado" junto de "grátis" (o grátis tem teto 50)
travessão      banido do texto das peças
domínio        sempre www.velofunil.com.br (sem o www custa um
               redirecionamento: 980ms contra 255ms, medido)
determinismo   sem relógio, sem random. Mesma entrada, mesmo arquivo
```

**Dados já usados em peças estáticas. Não reaproveite nenhum:**

```
21x       mais chance de qualificar respondendo em 5 min (InsideSales/MIT)
42h       média para responder o primeiro contato (HBR, 2.241 empresas)
3,4h      por semana digitando em CRM
55%       das implantações falham, 60% disso é adoção
82%       da PME vende por WhatsApp (Sebrae)
R$ 265    cinco pessoas a R$ 53 em CRM que cobra por usuário
```

Todo dado precisa da fonte impressa na própria peça. É o único conteúdo que
passa sem esbarrar na regra contra prova social.

---

## 5. A tentativa anterior, e por que foi reprovada

Isto vale mais que qualquer instrução do que fazer.

**O que foi feito:** um funil de três trapézios em contorno fino no centro da
tela, cards retangulares descendo pelas etapas, um deles travando no meio, e
texto centralizado acima. 14 segundos, sem áudio.

**O veredito do dono: não gostou.** E a leitura de por quê:

```
o funil em contorno fino      lê como wireframe animado, não como produto.
                              Linha de 2px sobre fundo escuro é diagrama de
                              documentação, não peça de marca

a metáfora é literal demais   "negócio parado" virou um retângulo que para
                              de se mover. O espectador entende em 1 segundo
                              e não há nada depois disso

layout de apresentação        texto centralizado em cima, ilustração embaixo,
                              trocando a cada 3 segundos. É a estrutura de um
                              slide, e o olho reconhece na hora

sem densidade                 quatro elementos na tela inteira, muito espaço
                              entre eles. Vídeo curto compete com feed cheio;
                              peça rarefeita perde antes de começar

ritmo plano                   quatro blocos de texto de duração igual, com o
                              mesmo fade. Sem aceleração, sem corte seco,
                              sem um momento que se destaque dos outros
```

**A lição:** a animação não pode ser a ilustração da frase. Se o texto diz
"para de andar" e a imagem mostra algo parando, o vídeo é uma legenda com
desenho. O movimento tem que carregar o que a frase **não** consegue dizer.

---

## 6. O que é verdade sobre este produto, e o que não é

Não há criador, não há cliente e não há depoimento. Isso elimina UGC, vídeo de
reação e prova social — os formatos de maior alcance. **Não invente nenhum
deles.**

O que sobra, e é verdade:

```
o produto existe e está em produção, com clientes reais de verdade nenhum
a dor é real e tem fonte pública
o preço é uma vantagem estrutural, não uma promoção
```

---

## 7. Restrições técnicas de execução

```
canvas       1080x1920 e 1080x1350, 30fps, MP4, yuv420p
duração      12 a 20s. Se cabe menor, faça menor
legenda      branca, contorno preto, SEM pílula de fundo.
             ESTÁTICA: legenda animada lê como "feito por marca".
             Auto-ajuste de ~58px até ~26px, nunca estoure a banda
áudio        NENHUM no arquivo. A trilha é anexada dentro do Instagram,
             porque som nativo entra na distribuição por áudio da
             plataforma. Queimar só em anúncio pago
0 a 3s       o gancho. Visual, verbal e texto na tela ao mesmo tempo
```

**O script deve ser Python**, gerando frames com Pillow e montando com `ffmpeg`
por `subprocess` (não use `moviepy`). O motivo não é preferência: o texto da
peça precisa nascer no código, onde testes conseguem lê-lo. MP4 é opaco, e uma
peça montada em editor é a única superfície onde o preço volta a poder mentir
sem nada avisar.

---

## 8. Os cinco criativos, e por que são cinco

Entregue **cinco vídeos**, não cinco versões de um. Cada um ataca um estágio de
consciência diferente, porque a pessoa que nunca pensou no problema e a que já
está com o cartão na mão não respondem à mesma peça.

```
1  A DOR QUE NINGUÉM NOMEIA        para quem acha que é normal
   Ela perde venda toda semana e não sabe. O criativo dá NOME ao que ela
   sente sem saber explicar. Sem produto, sem preço: só o reconhecimento.
   O comentário que ele busca é "é exatamente isso que acontece comigo".

2  O INIMIGO CERTO                 para quem sabe que tem o problema
   O WhatsApp guarda a conversa e não guarda o cliente. NÃO ataque o
   WhatsApp: valide o uso dele e mostre onde ele acaba. Esta é a peça de
   maior alcance, porque 82% do público se reconhece na primeira frase.

3  A CARTEIRA QUE VAI EMBORA       o argumento mais forte e o menos usado
   O vendedor sai da empresa e leva contato, negociação em aberto e
   histórico junto, porque tudo mora no celular dele. Esquecer uma venda
   dói uma vez; perder a carteira não tem conserto. É o único ângulo que
   fala com o DONO em vez de falar com o vendedor, e dono é quem paga.

4  A CONTA QUE NINGUÉM FAZ         para quem já está comparando
   A concorrência cobra por vendedor. Cinco pessoas a R$ 53 dão R$ 265 todo
   mês, e sobe a cada contratação. Aqui é R$ 49 pela empresa, e não sobe.
   Aritmética sobre preço de tabela pública, nunca comparação de qualidade.

5  A ÚLTIMA OBJEÇÃO                para quem quase decidiu
   "Vou ter que parar tudo para configurar" e "vou ficar preso lá dentro".
   As duas travam a assinatura no último passo. A resposta é o que já é
   verdade: começa grátis, importa planilha, e os dados saem quando quiser.
```

**A regra que mantém os cinco distintos:** se dois criativos pudessem trocar de
legenda sem ninguém notar, eles são o mesmo criativo. Cada um tem uma frase de
abertura, um grafismo e um desfecho que só funcionam nele.

### O que cada um precisa carregar

```
gancho     nos 3 primeiros segundos, e específico. "Você está perdendo
           vendas" é genérico e some no feed. A pessoa precisa se reconhecer
           numa situação, não num diagnóstico
uma ideia  uma por peça. Vídeo curto com dois argumentos entrega zero
chamada    uma linha, no fim, e diferente por peça. As de topo (1 e 2)
           pedem comentário ou salvamento; as de fundo (4 e 5) mandam ao
           site. Pedir assinatura em peça de topo queima alcance
```

**Sobre engajamento que vira cliente pagante, e não só curtida:** a métrica que
importa aqui é quem chega ao site e cria conta. Uma peça que faz rir e não move
ninguém custa o mesmo que uma que converte. Prefira o comentário de
reconhecimento ("é exatamente o meu caso") ao comentário de aplauso, porque o
primeiro é a pessoa se qualificando em público.

**Não invente urgência.** Nada de "últimas vagas", "só hoje" ou contagem
regressiva: não existe escassez neste produto, e inventá-la queima a confiança
que as peças 3 e 5 dependem de construir.

## 9. O que entregar

```
os 5 conceitos, cada um com o ângulo, o gancho e a chamada
o roteiro de cada um, batido em segundos
o script Python que gera os 5 nos DOIS formatos (10 arquivos)
o primeiro frame de cada peça, com a zona segura desenhada por cima
uma tira de 6 frames de cada peça, para ver o ritmo
```

### A régua

**Três perguntas, e a peça precisa passar nas três:**

1. **O movimento diz algo que uma imagem parada não diria?** Se a resposta é
   "mostra o que a frase já disse", o conceito é uma arte cara.
2. **Alguém que passe o dedo em 2 segundos leva alguma coisa?** A maioria não
   assiste até o fim.
3. **Se você tirar a marca, ainda parece deste produto?** Se qualquer SaaS
   pudesse assinar a peça, ela é template.

### A liberdade que você tem

Paleta, fontes e formatos são fixos — vêm dos tokens do produto, e trocá-los
criaria uma segunda marca para manter coerente.

**Composição, conceito, ritmo, grafismo e o desenho inteiro do movimento são
seus.** É aí que está o trabalho, e é exatamente aí que a tentativa anterior
falhou.

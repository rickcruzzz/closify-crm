# Perfil da Empresa no Google

Artes e textos para `business.google.com`. Gere com:

    python scripts/marketing/gerar-perfil-google.py

## O que vai onde

    capa.png                 1024x576   Fotos -> Capa
    produto.png             1080x1080   Fotos -> Da empresa
    atualizacao-lembrete.png 1200x900   Novidades -> Adicionar atualizacao

O logo do perfil **não** sai daqui: use `marketing/marca/selo-teal.svg`
convertido a 720x720, que é o mesmo ícone do app e do favicon. Marca não se
regera por canal.

---

## Os campos do perfil, com o texto pronto

Copie como está. Tudo abaixo é conferível — CNPJ, endereço e preço saem das
mesmas fontes que a landing usa.

### Nome da empresa

    Velo Funil

**Só o nome.** Não escreva "Velo Funil - CRM para PMEs": o Google trata nome
com palavra-chave como violação das diretrizes e pode suspender o perfil. A
categoria já diz o que a empresa faz.

### Categoria principal

    Empresa de software

Secundárias, se aceitar: `Serviço de consultoria em TI`.

### Descrição (750 caracteres, aparece em "Sobre")

    O Velo Funil é um CRM brasileiro para quem vende por orçamento:
    marcenaria, dedetizadora, comunicação visual, energia solar,
    locação de equipamentos.

    A diferença está no que acontece depois que o orçamento sai. Você
    guarda a validade, e o sistema cria sozinho a tarefa de dar o
    retorno dois dias antes de o prazo vencer — para o cliente não
    sumir no esquecimento.

    Lemos 25 sistemas de orçamento brasileiros: 88% geram o PDF, 48%
    guardam a validade, e nenhum avisa antes de o prazo acabar.

    Funil visual, contatos, tarefas e resultados. Preço fixo pela
    empresa inteira, nunca por vendedor. Comece grátis, sem cartão.

    Dados hospedados em São Paulo, conforme a LGPD.

### Endereço

    Av. Tancredo Neves, 2539, sala 2609
    Caminho das Árvores — Salvador/BA
    CEP 41.820-021

**Marque "atendo clientes no endereço deles" e defina a área de atendimento
como Brasil.** O produto é SaaS: quem procurar "CRM perto de mim" em Salvador
não é o cliente, e um pino no mapa sem atendimento presencial gera visita
frustrada e avaliação ruim.

### Site

    https://www.velofunil.com.br

### Horário

Segunda a sexta, 9h às 18h. **Não marque 24 horas** — o suporte é uma pessoa,
e horário que não se cumpre vira avaliação de uma estrela.

---

## As publicações (Novidades)

O Perfil chama de "atualização". Elas expiram em ~6 meses e aparecem na ficha
da empresa.

### 1 — O dado (usar `atualizacao-lembrete.png`)

    Lemos 25 sistemas de orçamento brasileiros para descobrir uma
    coisa: quantos avisam você antes de o prazo vencer.

    88% geram o PDF. 60% mandam pelo WhatsApp. Quase metade até guarda
    a data de validade.

    Avisar antes de o prazo acabar: nenhum.

    É isso que o Velo Funil faz. Você guarda a validade do orçamento, e
    dois dias antes de vencer aparece a tarefa de dar o retorno.

    Botão: Saiba mais -> https://www.velofunil.com.br

### 2 — O preço (usar `produto.png`)

    A maioria dos CRMs cobra por vendedor. Contratou alguém, a conta
    sobe.

    Aqui é R$ 97 por mês pela empresa inteira — uma pessoa ou dez, o
    mesmo preço. E tem plano grátis para sempre, sem cartão: 50
    contatos, 3 orçamentos com lembrete, funil e resultados.

    Botão: Saiba mais -> https://www.velofunil.com.br

### 3 — Para quem é (usar `capa.png`)

    Se o seu trabalho começa com "me manda o orçamento", o Velo Funil
    foi feito para você.

    Marcenaria, dedetizadora, comunicação visual, energia solar,
    locação. Quem manda proposta e depois precisa lembrar de cobrar o
    retorno — sem planilha e sem depender da memória.

    Comece grátis: velofunil.com.br

**Uma publicação por semana basta.** O Perfil não é rede social: quem chega
aqui já procurou o nome da empresa e está conferindo se ela é real. Volume não
melhora isso; consistência e informação correta, sim.

---

## O que NÃO fazer aqui

**Não peça avaliação antes de ter cliente.** Avaliação de conhecido é o que o
Google mais pune, e o perfil suspenso não volta fácil. Este produto tem zero
cliente externo pagante — a hora de pedir avaliação é depois do primeiro.

**Não use foto de banco de imagem.** Pela mesma razão registrada em
`marketing/instagram/fundos/LEIAME.md`: num SaaS a prova é a tela do produto.
E no Perfil isso é pior — o Google mostra as fotos junto das que os usuários
enviam, e stock photo ao lado de foto real denuncia na hora.

**Não marque categoria de serviço local** (tipo "Consultoria de marketing")
só porque tem mais busca. Categoria errada traz visita de quem quer outra
coisa, e a primeira avaliação ruim custa mais que o tráfego extra.

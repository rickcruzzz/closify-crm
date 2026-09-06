# 27 nichos medidos, e a regra que decidiu (06/09/2026)

Pergunta do dono: *"você investigou TODOS os nichos com mais altas chances?"*
Não — os dez primeiros eram uma lista que **eu inventei**. Esta rodada amplia
para 27, com os cinco então vigentes marcados `*` como controle na mesma
passagem.

**Método idêntico em todos:** uma semente de 10 sites (`search`, `category:
company`) e um lote de `contents`. Duas chamadas por nicho, 54 no total,
US$ 1,06.

## A regra, escrita ANTES de olhar o resultado

Ela sai do que o produto faz, não do que o número mostrou:

    ORCAMENTO >= 2   pedir orcamento cria negocio com valor, prazo e decisao
                     pendente. E literalmente uma linha do Kanban
    FORTE     >= 4   metade da amostra com sinal forte de propensao
    CONTATO   >= 6   sem canal na pagina, a lista nao vira ligacao

## O resultado

    nicho                n  media  FORTE  equipe  ORCA  agenda  contato
    dedetizacao         10   7.7     6      4      5      0       7    PASSA
    comunicacao-visual* 10   7.1     5      4      2      0       6    PASSA
    marcenaria*          9   7.4     4      2      3      0       6    PASSA
    locacao-equip       10   5.9     4      2      2      0       6    PASSA
    ti-outsourcing      10   7.0     6      6      1      0       6
    equip-medico         7   7.7     5      4      1      0       4
    contabilidade       10   6.8     5      5      0      0       7
    eventos              7   7.3     4      3      3      0       4
    climatizacao*        9   7.1     4      4      1      0       6
    licitacoes          10   6.4     4      4      0      0       8
    energia-solar        7   6.3     4      4      0      0       2
    medicina-trabalho   10   5.7     4      4      1      0       6
    seguranca           10   5.4     4      2      3      1       5
    automacao            9   5.0     4      4      1      0       3
    corretora-seguros    8   6.3     3      2      1      0       8
    produtora-video     10   5.9     3      3      0      0       7
    provedor-internet   10   5.6     3      3      1      0       6
    advocacia           10   4.3     3      3      0      0       4
    rh-recrutamento     10   4.1     3      3      0      0       3
    agencia*            10   4.0     3      2      0      0       4    REPROVA
    serralheria          7   8.6     2      2      1      0       6
    arquitetura          8   5.5     2      2      0      0       5
    facilities          10   4.9     2      1      1      0       6
    imobiliaria*         9   4.3     2      2      0      0       6    REPROVA
    treinamento          8   6.0     1      0      1      0       6
    transportadora       8   4.3     1      1      0      0       4
    paisagismo           8   3.5     1      0      1      0       4

## O que isso desmentiu

**`agencia` e `imobiliaria` ficaram no fundo**, e eu tinha decidido mantê-las
uma rodada antes. Agência: 3 FORTE, **zero** pedido de orçamento — ela vende por
reunião e proposta enviada por e-mail, não por formulário. Imobiliária: 2 FORTE,
zero orçamento — e o eixo qualitativo já pesava contra (sem integração com
VivaReal/ZAP o corretor não troca de sistema).

**`ti-outsourcing` tem o maior número de equipe (6 de 10) e não entra.** Falha
no orçamento, e há um motivo estrutural: MSP vive de chamado e já roda Movidesk,
GLPI ou Milvus. Quem já tem ferramenta é a venda mais cara que existe.

**`serralheria` tem a maior média (8,6) e não entra.** Média alta com 2 FORTE
significa sites ricos em contato e pobres em sinal de propensão — a média
premia alcance, e alcance não paga.

## O teto desta medição, dito por inteiro

Ela lê o **site**, não a carteira. Não sabe faturamento, não sabe se já existe
um CRM instalado, não sabe se a pessoa atende o telefone. Ordena candidato; não
prova venda. Quem prova é a primeira ligação.

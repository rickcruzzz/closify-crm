# Segunda pesquisa para o Perplexity — como escalar até 1.000 clientes

A primeira pesquisa ([pesquisa-perplexity-meta-ads.md](pesquisa-perplexity-meta-ads.md))
respondeu "quanto posso pagar por cliente". Esta responde outra coisa: **como
chegar a volume alto com ticket baixo**, que é um problema diferente e tem
soluções diferentes.

Ela leva os números que a primeira produziu, já calculados — então o Perplexity
não precisa estimar nada que já sabemos.

Copie tudo entre as linhas.

---

Preciso de um plano para levar um micro-SaaS brasileiro de **zero para 1.000
clientes pagantes** em 12 a 18 meses, com ticket baixo e sem investidor. Já fiz
a conta de mídia paga e sei o que ela sustenta; o que preciso agora é saber
**quais canais realmente produzem volume nesse modelo** e em que ordem atacá-los.

Responda para o Brasil, com fontes de 2025-2026, e me diga com clareza o que
**não** funciona nesse cenário.

## O negócio, com números medidos

**Velo Funil** (velofunil.com.br) — CRM de funil de vendas em Kanban para PME
brasileira de serviço: agências, consultorias, clínicas pequenas, imobiliárias
pequenas, software houses. Substitui planilha e caderno.

**Preço:** Grátis (1 empresa, 2 colaboradores, 300 contatos) · Pro **R$ 49/mês**.
Cobrança recorrente por Pix, boleto e cartão (Asaas).

**Números reais, medidos no banco de dados hoje — não são estimativa:**

| métrica | valor |
|---|---|
| empresas cadastradas (total) | 26 |
| **destas, contas de teste** (e-mail descartável) | **15** |
| **destas, contas minhas** (dono do produto) | **4** |
| ~~**clientes reais externos**~~ ERRADO | ~~8~~ → **0** |
| ~~clientes externos que ativaram~~ | ~~5 (62,5%)~~ |
| **clientes externos PAGANTES** | **0** |

> **Corrigido em 31/08.** Os 8 "clientes reais externos" desta tabela **não
> existem**: o dono confirmou que todos os cadastros desta base são teste dele.
> A separação foi feita por leitura do e-mail em vez de `ehContaDeTeste`
> (`lib/dono/contas-internas.ts`), a função oficial do projeto — a mesma
> armadilha registrada no `estado-atual.md`, e pela terceira vez.
>
> A conclusão da pesquisa sobre escala não depende deste número, mas qualquer
> leitura de ativação ou retenção a partir dele é inválida.

**A ressalva mais importante desta pesquisa, e eu preciso que ela oriente sua
resposta:** eu tinha 2 assinaturas marcadas como ativas, mas ao conferir os
e-mails descobri que **nenhuma é cliente externo** — uma é a conta em que eu
mesmo paguei um Pix de R$ 49 para testar o checkout, e a outra é uma conta de
cortesia criada para um vídeo de verificação. O único cliente externo que
tentou assinar ficou com pagamento em aberto e nunca concluiu.

Ou seja: **ninguém que não me conhece jamais pagou por este produto.** Não
tenho conversão de cadastro→pagante medida, não tenho churn, não tenho LTV.
Tenho apenas a prova de que 5 de 8 pessoas reais que criaram conta usaram o
produto de verdade. Nenhum deles veio de anúncio — nunca rodei campanha.

**A conta de mídia que já fiz** — mas com a ressalva de que ela usa uma
conversão de 7,7% que veio da base CONTAMINADA (incluía minhas contas de
teste). Com 0 pagantes externos, a conversão real é desconhecida, e estes
números são o cenário otimista, não a medição:
- Cada cliente, reinvestindo sua mensalidade em anúncio, gera **33% de um novo
  cliente por mês** se o CPL for R$ 11
- **CPL de equilíbrio com churn de 6%/mês: R$ 62,88** — acima disso a base
  encolhe, abaixo ela cresce sozinha
- Se a ativação subir de 62,5% para 85%, o CPL de equilíbrio sobe proporcionalmente
- Simulando reinvestimento com aporte de R$ 1.500/mês: **1.000 clientes
  acumulados em 13-15 meses**, dependendo do churn
- 1.000 clientes **novos por mês** exigiria R$ 147 mil/mês e R$ 441 mil de
  caixa — fora de alcance, e por isso não é a meta

**Restrições reais:**
- Aporte disponível: R$ 1.500/mês (R$ 50/dia)
- Operador único, sem equipe
- Sem investidor, sem capital para queimar
- Nunca inventar prova social (sem depoimento falso, sem "500 empresas usam")
- LGPD: uso Meta Pixel sem banner de consentimento hoje

## O que preciso que você pesquise

### 1. O canal certo para ticket de R$ 49 no Brasil
Produtos de assinatura barata raramente escalam só com mídia paga.
- Quais canais **de fato** levaram SaaS B2B brasileiro de ticket baixo
  (R$ 30-100/mês) a centenas ou milhares de clientes? Quero **casos com nome e
  número**, não categorias genéricas.
- Ranqueie por **custo de aquisição real e tempo até dar retorno**: mídia paga,
  SEO/conteúdo, indicação, parceria/revenda, marketplace, comunidade, outbound,
  PLG/viral. Qual a ordem correta para quem tem R$ 1.500/mês?
- Existe evidência de que algum desses canais entrega **CPL abaixo de R$ 60**
  de forma sustentável para B2B PME no Brasil?

### 2. Indicação e viralidade — o multiplicador que não custa mídia
- Que **programas de indicação** funcionam em SaaS B2B brasileiro de ticket
  baixo? Qual recompensa converte melhor: desconto, mês grátis, dinheiro,
  upgrade de plano?
- Qual **coeficiente viral** é realista para CRM de PME, e o que precisa existir
  no produto para que indicar seja natural em vez de forçado?
- Existe mecânica de viralidade **embutida no uso** de um CRM (por exemplo, o
  cliente do meu cliente ver a marca, colaborador convidado virar cliente
  próprio depois)? Quero exemplos reais de produtos que fizeram isso funcionar.

### 3. Canal de parceria — a alavanca que mais me interessa
Meu público é PME de serviço. Quem já fala com essas empresas todo mês?
- **Contadores** atendem dezenas de PMEs cada um. Existe modelo comprovado de
  SaaS brasileiro que cresceu por canal contábil? Como se estrutura a comissão,
  e o que faz o contador realmente recomendar?
- E **associações comerciais, Sebrae, sindicatos patronais, cooperativas de
  crédito**? Alguém escala por aí no Brasil?
- Que **modelo de revenda ou white-label** funciona para ticket baixo sem virar
  pesadelo de suporte?
- Qual comissão é padrão de mercado no Brasil (% recorrente, tempo de vigência)?

### 4. SEO e conteúdo — vale para esse ticket?
- Para "CRM para PME", "CRM simples", "CRM para clínica/agência/imobiliária" no
  Brasil: qual o **volume de busca real** e quão disputado está?
- Quanto tempo leva, realisticamente, para conteúdo virar aquisição em SaaS B2B
  brasileiro — e quanto conteúdo é necessário antes do primeiro cliente?
- Vale mais **comparação** ("alternativa ao Pipedrive", "CRM mais barato que
  RD Station") ou conteúdo de dor ("como parar de perder venda no WhatsApp")?
- Existe atalho por **marketplace ou diretório** (Capterra, GetApp, B2B Stack,
  RD Marketplace) que traga cliente qualificado no Brasil?

### 5. Ativação e a primeira venda
De 8 clientes externos, 5 usaram o produto de verdade (62,5%) e **nenhum
pagou**. O buraco não é a ativação — é a passagem de "usa de graça" para
"paga". E não custa mídia para atacar.
- Como um SaaS consegue a **primeira venda para um estranho**? Que táticas são
  documentadas para converter usuário gratuito ativo em pagante quando ainda não
  existe nenhum caso de sucesso para mostrar?
- O plano Grátis está **generoso demais** (300 contatos, 2 colaboradores)? Qual
  limite força a decisão de pagar sem parecer punição?
- Que táticas de onboarding mais elevam ativação em SaaS B2B? Quero número de
  impacto: tour guiado, dado de exemplo pré-carregado, importação de planilha
  logo na entrada, checklist, contato humano, vídeo curto.
- Vale **falar com o cliente por WhatsApp** nos primeiros dias? Existe dado
  sobre impacto de contato humano em ativação de SaaS de ticket baixo no Brasil?
- Qual sequência de **e-mail/WhatsApp nos primeiros 7 dias** tem melhor
  resultado documentado para reativar quem criou conta e sumiu?
- Como identificar o **momento-aha** de um CRM com poucos usuários? Existe
  método que funcione com base pequena, ou preciso esperar volume?

### 6. Preço — R$ 49 é o número certo?
Esta é a pergunta que mais pode mudar o jogo, e quero que você a trate sem medo.
- Ticket de R$ 49 é **baixo demais** para sustentar aquisição paga no Brasil?
  Qual a faixa de preço em que SaaS B2B PME brasileiro consegue pagar mídia com
  folga?
- Se eu **subir para R$ 79 ou R$ 99**, o que a literatura diz sobre o impacto em
  conversão e em churn nesse segmento? O ganho de margem compensa a perda de
  volume?
- Vale ter **mais de um plano pago** (ex.: R$ 49 e R$ 149) para elevar o ticket
  médio? Que recursos costumam justificar o plano superior num CRM de PME?
- **Plano anual com desconto**: qual % é padrão no Brasil, e quanto ele melhora
  caixa e churn na prática?
- Existe evidência sobre **cobrar por usuário** vs. **preço fixo por empresa**
  para esse público? Qual escala melhor?

### 7. Retenção — onde 1.000 clientes se sustentam ou se perdem
Com 1.000 clientes e churn de 6%/mês, perco 60 por mês. Preciso repor 60 só
para ficar parado.
- Quais são as **causas mais comuns de churn** em CRM para PME, e quais têm
  solução no produto?
- Que sinais preveem cancelamento em CRM (queda de uso, parar de criar negócio,
  não logar por X dias)? Existe modelo simples que funcione com base pequena?
- Vale investir em **sucesso do cliente** com ticket de R$ 49? A partir de
  quantos clientes isso se paga?
- Como reduzir **churn involuntário** (falha de cobrança) no Brasil? Qual a taxa
  típica de falha por método de pagamento?

### 8. O plano, em fases
Termine com um **plano por fases até 1.000 clientes**, assumindo R$ 1.500/mês:
- **Fase 1 (0-50 clientes)**: qual canal, qual foco, o que ignorar
- **Fase 2 (50-200)**: o que muda, o que começa a valer a pena
- **Fase 3 (200-1.000)**: o que só funciona nessa escala
- Em cada fase: **qual métrica observa** e **qual número diz para mudar de fase**
- O que **não fazer** em cada fase, mesmo que pareça tentador

## Como quero a resposta

- Casos brasileiros reais com número, sempre que existirem
- Fontes de 2025-2026, com a data de cada dado
- Quando não houver dado confiável para o Brasil, diga isso e ofereça o
  equivalente internacional avisando que é de outro mercado
- Se a conclusão honesta for que **1.000 clientes com ticket de R$ 49 exige
  mudar o preço ou o modelo**, diga isso com todas as letras e mostre a conta
- Prefira "faça X, nesta ordem, por este motivo" a lista de possibilidades

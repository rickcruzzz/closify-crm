# Prompt para o Perplexity (modo Pesquisa / Research)

Copie **tudo o que está entre as linhas** abaixo e cole no Perplexity com o
modo de pesquisa profunda ativado.

Escrito com os números reais do Velo Funil conferidos em 22/08/2026 — não com
estimativa. Onde o dado não existe, o prompt diz que não existe, porque
esconder isso faria a pesquisa recomendar em cima de premissa falsa.

---

Sou dono de um micro-SaaS brasileiro e preciso de um plano de aquisição por
Meta Ads que caiba num orçamento pequeno e sobreviva ao meu volume real, que é
baixo. Preciso de respostas específicas para o Brasil em 2026, com fontes
recentes, e preciso que você me diga **o que não vale a pena** com a mesma
clareza com que diz o que vale.

## O produto, com números reais

**Velo Funil** (velofunil.com.br) — CRM de vendas em funil Kanban para PME
brasileira de serviço: agências, consultorias, clínicas pequenas, imobiliárias
pequenas, software houses. Posicionamento: "simples como planilha, premium como
software líder". Substitui a planilha e o caderno, não concorre de frente com
Salesforce.

**Preço:** Grátis (1 empresa, 2 colaboradores, 300 contatos) · Pro R$ 49/mês
(ilimitado). Cobrança recorrente por Pix, boleto e cartão via Asaas.

**Estado real do negócio, medido no banco de dados, não estimado:**

| métrica | valor |
|---|---|
| empresas cadastradas (total) | 26 |
| **destas, contas de teste** (e-mail descartável) | **15** |
| **destas, contas minhas** (dono do produto) | **4** |
| **clientes reais externos** | **8** |
| clientes externos que ativaram (criaram 1º contato) | **5 (62,5%)** |
| **clientes externos PAGANTES** | **0** |

**A ressalva mais importante desta pesquisa, e eu preciso que ela oriente sua
resposta:** eu tinha 2 assinaturas marcadas como ativas, mas ao conferir os
e-mails descobri que **nenhuma é cliente externo** — uma é a conta em que eu
mesmo paguei um Pix de R$ 49 para testar o checkout, e a outra é uma conta de
cortesia criada para um vídeo de verificação. O único cliente externo que
tentou assinar ficou com pagamento em aberto e nunca concluiu.

Ou seja: **ninguém que não me conhece jamais pagou por este produto.** Não
tenho conversão de cadastro→pagante medida, não tenho churn, não tenho LTV.
Tenho apenas a prova de que 5 de 8 pessoas reais que criaram conta usaram o
produto de verdade.

- **Nenhuma campanha de anúncio jamais rodou.** Três campanhas existem na conta,
  todas pausadas, gasto zero. Parto do zero absoluto em tráfego pago.
- Aquisição até hoje: 100% orgânica/indicação

**Ticket e economia unitária:**
- R$ 49/mês, sem taxa de setup, sem contrato de fidelidade
- **Não tenho churn, LTV nem taxa de conversão para pagante** — não por falta de
  medição, mas porque a conversão nunca aconteceu com cliente externo
- Custo marginal por cliente é baixo (SaaS em infraestrutura serverless)

## O que já está tecnicamente pronto

- **Meta Pixel instalado e disparando** de produção (id confirmado ativo, com
  milhares de PageView, 16 CompleteRegistration e 3 Purchase nos últimos 7 dias, conferido na API da Meta hoje)
- **Conversions API (CAPI) enviando server-side**, com hash SHA-256 de e-mail,
  telefone e external_id no `user_data`
- **UTM e fbc/fbp capturados e gravados no banco** na criação da conta — a
  ponte entre "clique no anúncio" e "virou cliente pagante" existe no código,
  mas **nunca foi exercitada**, porque nunca houve clique de anúncio
- Eventos que já disparam: PageView, CompleteRegistration (cadastro), Purchase
  (pagamento confirmado)
- Site rápido: rotas logadas entre 400ms e 900ms, landing estática servida por
  CDN
- Landing com prova social real apenas — **decisão travada de nunca inventar
  depoimento, número ou logo de cliente**

## Restrições que não vou violar (não sugira nada que dependa delas)

1. **Sem prova social inventada.** Nada de depoimento fictício, "mais de 500
   empresas", selo falso ou logo de cliente que não é cliente.
2. **LGPD levada a sério.** Uso rastreamento de terceiro (cookie `_fbp`) e
   **não tenho banner de consentimento**. Preciso saber se isso me impede de
   escalar e o que exatamente é obrigatório no Brasil em 2026 — com a fonte.
3. **Orçamento inicial pequeno**: R$ 30 a R$ 50/dia. Preciso de plano que
   funcione nessa faixa, não de estratégia que só faz sentido com R$ 500/dia.
4. **Sou o único operador.** Nada que exija equipe de mídia ou produção diária
   de criativo em volume industrial.

## O que eu preciso que você pesquise e responda

### 1. Economia do funil — o número que decide tudo
Com ticket de **R$ 49/mês** no mercado brasileiro de SaaS B2B para PME em 2026:
- Qual **CAC máximo** é sustentável, e em quantos meses o payback precisa
  acontecer para não quebrar o caixa de quem não tem investidor?
- Quais são os **benchmarks reais e recentes** (2025-2026) de CPM, CPC e custo
  por lead no Meta Ads para SaaS B2B no Brasil? Quero faixa com fonte, não
  chute.
- Qual **taxa de conversão** de visitante→cadastro e cadastro→pagante é
  considerada normal, boa e excelente nesse segmento? Preciso saber se meu
  funil está furado antes de gastar mais.
- Com ticket tão baixo, **tráfego pago frio é viável ou é armadilha** para esse
  tipo de produto? Se for armadilha, o que funciona no lugar? Quero a resposta
  honesta, mesmo que seja "não anuncie ainda".

### 2. Estrutura de campanha para orçamento pequeno
- **Qual objetivo de campanha** usar: Conversões otimizando para
  CompleteRegistration, ou para Purchase? Com apenas 3 Purchase em 7 dias (e 16
  CompleteRegistration),
  provavelmente não tenho volume para o algoritmo sair da fase de aprendizado
  em Purchase — **qual é o limiar real de eventos/semana** que o Meta exige
  para sair de learning, e como se contorna isso com pouco volume?
- **Advantage+ Sales Campaign (ASC) ou campanha manual** com R$ 30-50/dia?
  Quero prós e contras para volume baixo especificamente.
- **CBO ou ABO** nesse orçamento? Quantos conjuntos e quantos criativos por
  conjunto antes de fragmentar demais o aprendizado?
- **Quanto tempo e quanto dinheiro** um teste precisa consumir antes de a
  decisão de pausar/escalar ser estatisticamente honesta e não superstição?

### 3. Público — o que realmente funciona no Brasil hoje
- **Público amplo vs. detalhado** para B2B PME brasileira em 2026: a segmentação
  detalhada ainda entrega, ou o algoritmo amplo já ganha na maioria dos casos?
- Como alcançar **dono de PME de serviço** (agência, clínica, consultoria,
  imobiliária) sem interesses óbvios e caros? Existem interesses ou
  comportamentos subutilizados que funcionam para esse perfil?
- **Lookalike com base minúscula**: com 8 clientes externos e nenhum pagante,
  vale criar lookalike? Qual o tamanho mínimo real de semente para o lookalike não virar
  ruído?
- **Retargeting com tráfego baixo**: com poucos visitantes/dia, o público de
  remarketing atinge tamanho útil? A partir de quantos visitantes/dia isso
  passa a valer?

### 4. Criativo e oferta — o que converte para esse público
- **Que ângulo de criativo converte melhor** para dono de PME brasileira
  trocando planilha por CRM? Especificamente: dor de perder venda por
  esquecimento vs. medo de perder a carteira quando o vendedor sai vs. desejo
  de organização/status. Existe pesquisa sobre qual gatilho performa melhor
  nesse público?
- **Formato**: vídeo curto, carrossel, imagem estática ou depoimento em vídeo?
  O que rende mais para SaaS B2B de ticket baixo no Brasil em 2026?
- Existe evidência de que **mostrar a tela real do produto** converte melhor que
  criativo conceitual/ilustrado para esse público?
- **Qual oferta de entrada** converte mais para SaaS B2B brasileiro nessa faixa
  de preço: teste grátis sem cartão, freemium permanente, desconto no primeiro
  mês, ou garantia de reembolso? Quero dado, não opinião. (Hoje tenho freemium
  permanente.)
- Quantos criativos preciso ter rodando ao mesmo tempo com R$ 30-50/dia sem
  fragmentar o orçamento?

### 5. Rastreamento, pixel e LGPD — o que vale e o que é excesso
Esta é a parte que mais me interessa: **quero saber onde vale investir em
rastreamento e onde é desperdício de esforço.**
- **Vale a pena instalar script/pixel em mais lugares do produto** (dentro do
  app logado, em ações específicas) ou o retorno some depois dos eventos
  principais? Quero saber o **ponto de saturação** — a partir de onde mais
  evento não melhora mais entrega.
- Quais **eventos personalizados** realmente melhoram a otimização para SaaS
  B2B? Faz diferença enviar eventos de ativação (primeiro contato cadastrado,
  primeiro negócio criado) ou o Meta só otimiza bem para eventos de compra?
- Qual o impacto real medido de **Event Match Quality alto** no custo por
  resultado? Já mando e-mail, telefone e external_id com hash — vale mandar
  mais parâmetros (nome, cidade, CEP)? Qual o ganho concreto?
- **Deduplicação Pixel + CAPI**: qual o erro mais comum que faz o Meta contar
  duas vezes ou descartar evento, e como conferir se a minha está correta?
- **LGPD**: preciso de banner de consentimento para rodar Meta Ads legalmente no
  Brasil em 2026? Se sim, qual o impacto medido na taxa de conversão e na
  qualidade do rastreamento? Existe forma de fazer isso sem destruir a
  atribuição? Quero a base legal citada.
- **Qualidade dos dados vs. volume**: com pouquíssimas conversões, o que o Meta
  precisa de mim para otimizar bem? Existe estratégia documentada para "dar
  sinal" ao algoritmo quando o volume real é baixo?

### 6. Recorrência e retenção — onde o dinheiro realmente está
Meu negócio é assinatura. Cliente que fica 12 meses vale 12× mais que um que
fica 1 mês, e adiantar isso muda tudo no CAC que posso pagar.
- Qual **churn mensal** é considerado normal, bom e ruim para SaaS B2B de ticket
  baixo (R$ 30-80/mês) no Brasil?
- Quais alavancas de **ativação nos primeiros 7 dias** mais reduzem churn em CRM
  para PME? Existe pesquisa sobre o "momento aha" desse tipo de produto?
- **Anual com desconto vs. mensal**: qual o impacto real em churn, em caixa e no
  CAC que se pode pagar? Vale oferecer com quantos % de desconto?
- **Cobrança recorrente no Brasil**: qual método tem menos falha involuntária —
  cartão, Pix automático ou boleto? Qual a taxa típica de falha de cobrança e o
  que reduz isso? (Uso Asaas e aceito os três.)
- Que **estratégia de reativação** funciona para quem entrou no Grátis e nunca
  virou pagante? E para quem cancelou?

### 7. O plano concreto, em ordem
Termine com um **plano de execução em etapas**, assumindo que estou partindo do
zero em tráfego pago com R$ 30-50/dia:
- O que fazer nos **primeiros 30 dias**, exatamente, e quanto gastar
- Qual métrica observar em cada etapa e **qual número significa "pare"** e qual
  significa "escale"
- Em que ordem investir esforço: criativo, público, oferta, rastreamento,
  landing ou retenção — **e por quê nessa ordem**
- **O que NÃO fazer** com orçamento pequeno, mesmo que todo mundo recomende

## Como quero a resposta

- Priorize **fontes de 2025-2026** e diga a data de cada dado; se algo for
  anterior, avise que pode estar desatualizado
- Cite as fontes de forma que eu consiga conferir
- Quando não houver dado confiável, **diga que não há** em vez de preencher com
  estimativa apresentada como fato
- Prefira **números e faixas** a conselho genérico
- Se a conclusão honesta for "com esse ticket e esse volume, tráfego pago frio
  ainda não é o caminho — faça X antes", **diga isso claramente**. Prefiro
  descobrir agora do que depois de queimar R$ 1.500.

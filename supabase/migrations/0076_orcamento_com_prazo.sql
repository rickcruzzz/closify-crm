-- Orçamento com prazo: o objeto que o ICP manipula o dia inteiro.
--
-- ## Por que esta migration existe
--
-- Medido em 07/09/2026 sobre 61 concorrentes (docs/mercado/lacuna-de-produto-2026-09-07.md):
--
--     proposta / orcamento   59% (36/61) do mercado anuncia   nos: NAO temos
--
-- E `proposta` existia aqui só como NOME DE ETAPA: `deal_stage` tem
-- `proposta_enviada` e nenhuma função gerava uma.
--
-- Duas medições independentes apontam para o mesmo objeto. A outra é a régua
-- que escolheu os cinco nichos da prospecção em 07/09, cujo critério principal
-- era `ORCAMENTO >= 2` — dedetização, marcenaria, comunicação visual, locação
-- e eventos entraram porque VENDEM POR ORÇAMENTO. E a mensagem de abordagem
-- que sai para eles diz, com estas palavras: "quando você manda um orçamento e
-- o cliente não responde, quem lembra de cobrar de volta?".
--
-- O produto cobrava por um recurso que não tinha.
--
-- ## O recorte, e por que ele NÃO é "gerar proposta"
--
-- Dentro dos 56 domínios que anunciam proposta:
--
--     43%  PDF
--      4%  VALIDADE / vencimento
--      0%  AVISO de que o prazo esta acabando
--
-- Os dois últimos são quase inexistentes no mercado e são exatamente o motor
-- que já existe aqui: tarefa, prazo e a tela `/hoje`. O h1 da landing diz isso
-- desde sempre — "A planilha organiza. Ela não avisa quem está esperando."
--
-- Por isso o recurso é "o orçamento tem prazo, e o sistema cobra o retorno",
-- e não um gerador de documento. O PDF entra junto porque 43% do mercado tem e
-- a ausência aparece na comparação, mas ele é o acabamento, não a tese.
--
-- ## Sem trava de plano AQUI, e isso é decisão
--
-- Nenhuma trigger de limite nesta migration. O orçamento é do plano Free e é
-- ilimitado, porque ele é o gancho: quem nunca sentiu o produto cobrar o
-- retorno de um orçamento não tem por que pagar por ele.
--
-- A linha do Pro é o PDF, e ela é aplicada onde o PDF é GERADO
-- (`app/api/negocios/[dealId]/orcamento.pdf`), lendo `pro_vigente()` no
-- servidor. Gate de plano em tabela seria a trava errada: o dado é do cliente
-- e ele pode lê-lo; o que custa e o que vale dinheiro é o documento pronto.

alter table public.deals
  -- `date` e não `timestamptz`: validade de orçamento é dia de calendário
  -- ("vale até 15/09"), não instante. Guardar hora obrigaria a escolher um
  -- fuso para uma informação que não tem hora, e o servidor da Vercel roda em
  -- UTC — às 21h de São Paulo já é o dia seguinte lá, que é o defeito que
  -- `diaEmSaoPaulo` existe para evitar em `lib/tasks/buckets.ts`.
  add column orcamento_validade date,

  -- O "o que foi proposto". Texto livre de propósito: itemização com catálogo
  -- de produto é 23% do mercado e um schema inteiro; a PME que este produto
  -- atende escreve "Dedetização de 3 dormitórios + garagem, 2 aplicações".
  add column orcamento_descricao text,

  -- O ELO DIRETO com a tarefa de retorno, e ele é o que torna a ação
  -- idempotente.
  --
  -- A alternativa era achar a tarefa pelo título ("Cobrar retorno do
  -- orçamento"). Isso quebra no instante em que alguém renomeia a tarefa na
  -- tela — e aí registrar o orçamento de novo criaria uma SEGUNDA cobrança
  -- para o mesmo negócio, que é a classe de defeito que o `reactStrictMode`
  -- do Next 14 (que invoca a action duas vezes em desenvolvimento) revela em
  -- uma tarde e produção revela em silêncio.
  --
  -- `on delete set null` e não `cascade`: quem apagar o lembrete em `/hoje`
  -- está dizendo "não me cobra disso", não "apague meu orçamento". Perder o
  -- elo é recuperável (registrar de novo recria a tarefa); perder o orçamento
  -- não é.
  add column orcamento_tarefa_id uuid references public.tasks (id) on delete set null;

-- O ano vem de `<input type="date">`, que aceita 0111 sem reclamar. Isso já
-- encheu esta MESMA tabela de prazos como `0111-11-11`, exibidos pela tela
-- como "atrasado há 699.346 dias" — o defeito que o comentário de `dueDate`
-- em `lib/validations/deal.ts` documenta. A faixa é a mesma de lá, para as
-- duas datas do negócio não terem regras diferentes sem motivo.
alter table public.deals
  add constraint deals_orcamento_validade_plausivel
  check (
    orcamento_validade is null
    or (orcamento_validade >= date '2000-01-01' and orcamento_validade <= date '2100-12-31')
  );

-- Teto de tamanho, não de conteúdo. 2.000 caracteres é uma página cheia de
-- descrição de serviço; acima disso é colagem acidental, e o PDF de uma
-- página deixaria de caber sem nada avisando.
alter table public.deals
  add constraint deals_orcamento_descricao_cabe
  check (orcamento_descricao is null or char_length(orcamento_descricao) <= 2000);

-- Orçamento sem preço não é orçamento.
--
-- `deals.value` nasce em 0, então sem esta regra um orçamento com validade e
-- R$ 0,00 seria aceito, cairia em `/hoje` cobrando retorno, e o PDF sairia
-- para o cliente do cliente dizendo "R$ 0,00". O erro seria visível só depois
-- de enviado, que é tarde demais.
--
-- Vale nos DOIS sentidos: também impede zerar o valor de um negócio que já
-- tem orçamento vivo.
alter table public.deals
  add constraint deals_orcamento_tem_valor
  check (orcamento_validade is null or value > 0);

comment on column public.deals.orcamento_validade is
  'Dia em que o orçamento deixa de valer. Preenchido, a Server Action cria a tarefa de cobrar retorno e guarda o id em orcamento_tarefa_id.';

comment on column public.deals.orcamento_tarefa_id is
  'A tarefa de retorno deste orçamento. Elo direto para a ação ser idempotente — achar por título quebra quando alguém renomeia a tarefa.';

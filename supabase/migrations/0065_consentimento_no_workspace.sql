-- O consentimento de análise, guardado junto da empresa.
--
-- ## Por que o cookie não basta
--
-- A decisão do banner vive em `localStorage` e, desde 02/09, também num cookie
-- espelho que o servidor lê. Isso resolve os cinco eventos disparados durante
-- uma requisição do visitante — `Lead`, `CompleteRegistration`,
-- `CustomizeProduct`, `InitiateCheckout`, `AddPaymentInfo`.
--
-- **Não resolve o `Purchase`**, e ele é o que mais importa. Ele nasce no
-- webhook do Asaas: quem faz a requisição é o gateway, não a pessoa. Não há
-- cookie, não há `localStorage`, não há visitante.
--
-- Sem esta coluna restariam duas saídas ruins: não enviar Purchase nunca
-- (perdendo a conversão principal), ou isentá-lo da regra (mantendo o buraco
-- justamente no evento que manda e-mail, telefone, nome, cidade, estado e CEP).
--
-- ## Por que em `workspaces`, e não numa tabela nova
--
-- A atribuição (`utm_source`, `fbc`, `fbp`) já mora aqui pela mesma razão:
-- é um fato sobre a empresa, capturado uma vez na entrada, lido depois por
-- quem precisar. Uma tabela só para isto teria uma linha por empresa e uma
-- junção a mais em todo caminho.
--
-- ## `null` é "não sei", e não vale como aceite
--
-- Empresa criada antes desta coluna, ou pessoa que nunca respondeu o banner,
-- fica `null`. A leitura trata os dois como recusa — ausência de decisão nunca
-- é consentimento, que é a mesma regra do pixel e do cookie.

alter table public.workspaces
  add column if not exists consentimento_analitico boolean;

comment on column public.workspaces.consentimento_analitico is
  'Aceite do banner de análise. null = nunca respondeu, e nao vale como aceite. Lido pelo webhook do Asaas, que nao tem cookie.';

-- E-mail deixa de ser obrigatório no lead.
--
-- `leads.email` nasceu `not null` na 0001. Parecia razoável até a importação
-- de planilha encostar na realidade do público-alvo: a planilha de uma PME de
-- serviço no Brasil é lista de WhatsApp — nome e telefone, sem e-mail nenhum.
-- Com a coluna obrigatória, um arquivo desses importava ZERO linhas, e a tela
-- só sabia dizer "e-mail ausente" trezentas vezes.
--
-- Não é afrouxar validação: a regra continua existindo, só mudou de forma. O
-- que importa num CRM não é ter e-mail, é HAVER COMO FALAR com a pessoa. A
-- constraint abaixo exige e-mail OU telefone, e recusa a linha que não tem
-- nem um nem outro — que é lixo de planilha, não lead.
--
-- `coalesce(..., '') <> ''` em vez de `is not null` de propósito: string vazia
-- passa por `not null` e é exatamente o que uma célula em branco vira quando
-- alguém insere pelo PostgREST.
--
-- O formulário manual (lib/validations/lead.ts) segue exigindo os dois campos.
-- Quem digita um lead tem a informação na mão; quem importa, não.

alter table public.leads alter column email drop not null;

alter table public.leads
  add constraint leads_contato_minimo
  check (coalesce(email, '') <> '' or coalesce(phone, '') <> '');

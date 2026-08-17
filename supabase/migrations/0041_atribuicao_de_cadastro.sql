-- Velo Funil, de onde cada empresa veio (UTM de primeiro toque).
--
-- Sem cliente pagante ainda, mas tráfego pago está prestes a começar. Sem
-- isto, não dá pra cruzar "qual campanha trouxe quem virou pagante" quando
-- o primeiro Pro de verdade acontecer, a pergunta mais importante pra
-- saber em que anúncio gastar mais.
--
-- Colunas direto em `workspaces`, não tabela separada: é metadado de
-- criação, um valor por empresa, nunca múltiplos registros, não há relação
-- que justifique uma tabela própria. Todas nullable: a maioria das contas
-- não vem de campanha nenhuma.
alter table public.workspaces
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text;

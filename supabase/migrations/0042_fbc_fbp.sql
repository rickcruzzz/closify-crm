-- Velo Funil, fbc/fbp junto da atribuição de UTM (0041).
--
-- `fbc` (id de clique, derivado do fbclid) e `fbp` (id de navegador, cookie
-- _fbp do próprio Pixel) são as âncoras mais fortes de match da Conversions
-- API do Meta, mais fortes que e-mail sozinho. Guardados junto de
-- utm_source/medium/campaign porque nascem no mesmo lugar (primeiro
-- carregamento da landing, components/landing/utm-capture.tsx) e morrem
-- juntos (nenhum sentido em ter um sem o outro).
alter table public.workspaces
  add column fbc text,
  add column fbp text;

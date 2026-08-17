-- Velo Funil, teto de leads do Free: 25 → 300.
--
-- Pesquisa de mercado (13/08/2026, agente market-researcher, 2 rodadas)
-- comparou o Free contra 11 concorrentes brasileiros de ticket baixo:
-- Zoho Bigin (o mais restrito confirmado) dá 500 registros grátis pra
-- sempre; Agendor dá 1.500 negócios; Bitrix24 e RD Station dão
-- contato/negócio ILIMITADO no free. O teto de 25 (baixado de 50→25 na
-- migration 0037, sem dado de mercado na época) era, de longe, o mais
-- apertado do mercado mapeado, desvantagem competitiva visível pra
-- qualquer dono de PME comparando lado a lado.
--
-- 300 é o topo da faixa recomendada pela pesquisa ("~200-300, aproximando
-- do mais restrito sem igualar os mais generosos"), continua abaixo do
-- Zoho Bigin, longe dos ilimitados, então o Free segue mais limitado que
-- o mercado, só deixa de ser o pior por larga margem. A pressão de
-- conversão do Free passa a vir majoritariamente das integrações
-- Pro-only (0037) e do teto de 1 empresa/2 colaboradores, não mais do
-- número de leads.
create or replace function public.checar_limite_de_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_pro boolean;
  limite_free constant int := 300;
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;

  v_pro := public.pro_vigente(new.workspace_id);
  if v_pro then
    return new;
  end if;

  select count(*) into v_total from public.leads where workspace_id = new.workspace_id;

  if v_total >= limite_free then
    raise exception 'Plano Free permite no máximo % leads. Faça upgrade para o Pro para continuar.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;

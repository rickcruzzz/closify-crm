-- Reversão estrutural da expansão 20261022144429.
-- Aplicações antigas podem continuar usando o esquema expandido: as colunas
-- são opcionais. Prefira reverter a aplicação e preservar as imagens.
-- Este script recusa apagar metadados já preenchidos. Para remoção definitiva,
-- exporte antes os cinco campos novos por ID (e mantenha cópia dos arquivos
-- privados referenciados); só então decida explicitamente sobre sua limpeza.
-- Nenhum objeto do bucket avatares é apagado por este script.
begin;
do $$
begin
  if exists (select 1 from public.leads where foto_tentada_em is not null)
     or exists (select 1 from public.enterprise_eventos
       where foto_path is not null or foto_fonte_url is not null
         or foto_verificada_em is not null or foto_tentada_em is not null) then
    raise exception 'Rollback interrompido: há metadados de fotos preenchidos.'
      using hint = 'Reverta a aplicação mantendo as colunas, ou exporte os metadados e preserve os arquivos antes de autorizar sua remoção.';
  end if;
end;
$$;
drop index if exists public.leads_empresa_foto_tentada_idx;
drop index if exists public.enterprise_eventos_empresa_foto_tentada_idx;
alter table public.leads drop column if exists foto_tentada_em;
alter table public.enterprise_eventos
  drop column if exists foto_path,
  drop column if exists foto_fonte_url,
  drop column if exists foto_verificada_em,
  drop column if exists foto_tentada_em;
commit;

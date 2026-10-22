-- Expansão compatível: nenhuma imagem, contato ou política de acesso é alterada.
begin;

alter table public.leads
  add column if not exists foto_tentada_em timestamptz;

create index if not exists leads_empresa_foto_tentada_idx
  on public.leads (workspace_id, foto_tentada_em);

comment on column public.leads.foto_tentada_em is
  'Última tentativa de obter a foto do WhatsApp, inclusive em falhas transitórias. Permite revezar tentativas sem confundir erro com ausência confirmada de foto.';

alter table public.enterprise_eventos
  add column if not exists foto_path text,
  add column if not exists foto_fonte_url text,
  add column if not exists foto_verificada_em timestamptz,
  add column if not exists foto_tentada_em timestamptz;

create index if not exists enterprise_eventos_empresa_foto_tentada_idx
  on public.enterprise_eventos (workspace_id, foto_tentada_em);

comment on column public.enterprise_eventos.foto_path is
  'Cópia da imagem obtida da fonte no bucket privado avatares, sob {workspace_id}/empresas/. URL assinada é criada somente na leitura.';
comment on column public.enterprise_eventos.foto_fonte_url is
  'URL original da imagem obtida na pesquisa; evidencia a origem, não é uma URL assinada do Storage.';
comment on column public.enterprise_eventos.foto_verificada_em is
  'Quando a imagem da fonte foi verificada pela última vez; nulo significa ainda não verificada.';
comment on column public.enterprise_eventos.foto_tentada_em is
  'Última tentativa de obter a imagem da fonte, inclusive em falhas transitórias; permite retentativas justas sem bloquear novas empresas.';

-- Reutiliza as políticas de Enterprise e avatares existentes:
-- somente service_role escreve arquivos, somente membros da empresa os leem.
commit;

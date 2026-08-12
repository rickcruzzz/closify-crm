-- Velo Funil — logo da empresa no Supabase Storage
--
-- O projeto nunca usou Storage: nenhuma linha de código o toca. Isto abre uma
-- superfície de segurança nova, e a regra é a mesma das tabelas — arquivo de
-- uma empresa não pode ser lido nem sobrescrito por outra.
--
-- (Existe um bucket `vvv` neste projeto, privado, com um arquivo, criado à mão
-- em 11/08. Não é do produto e não é tocado aqui.)

-- ============================================================================
-- 1. Bucket privado
-- ============================================================================
--
-- PRIVADO de propósito. Bucket público serve o arquivo a quem souber a URL, e
-- a URL contém o id do workspace — que aparece em resposta de API para
-- qualquer membro. Bastaria alguém colecionar ids para baixar a marca de todo
-- mundo. A exibição passa a usar URL assinada, com validade curta.
--
-- O teto e a lista de tipos aqui são a segunda linha de defesa, não a
-- primeira: `allowed_mime_types` compara com o Content-Type que o CLIENTE
-- declara, e o cliente mente. A checagem que vale é a dos bytes do arquivo,
-- feita no servidor (lib/storage/logo.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  false,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- ============================================================================
-- 2. De qual empresa é o arquivo
-- ============================================================================
--
-- O caminho é `{workspace_id}/{uuid}.{ext}`, e a política precisa do primeiro
-- segmento como uuid. `(storage.foldername(name))[1]::uuid` direto estoura
-- quando o caminho não tem esse formato — e quem escolhe o caminho é quem
-- envia o arquivo, então o formato torto é a regra, não a exceção.
--
-- Esta função devolve `null` nesse caso, e `is_workspace_member(null)` é
-- `false`. Ou seja: caminho fora do padrão não pertence a ninguém e não passa
-- por nenhuma das políticas abaixo.

create or replace function public.workspace_do_caminho(caminho text)
returns uuid
language plpgsql
immutable
set search_path to ''
as $$
declare
  v_primeiro text;
begin
  v_primeiro := (storage.foldername(caminho))[1];

  if v_primeiro is null or v_primeiro !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return v_primeiro::uuid;
exception
  when others then
    return null;
end;
$$;

-- ============================================================================
-- 3. Políticas — ler é de membro, escrever é de admin
-- ============================================================================
--
-- Mesma divisão que `workspaces_update` já faz: o colaborador vê a marca da
-- empresa em que trabalha, mas quem troca a identidade visual dela é admin.

drop policy if exists "logos_select" on storage.objects;
create policy "logos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

drop policy if exists "logos_insert" on storage.objects;
create policy "logos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (select public.is_workspace_admin(public.workspace_do_caminho(name)))
  );

-- `using` e `with check` juntos no update: sem o `with check`, um admin podia
-- RENOMEAR o próprio arquivo para dentro da pasta de outra empresa — a
-- checagem de `using` olha a linha ANTES da mudança e aprovaria.
drop policy if exists "logos_update" on storage.objects;
create policy "logos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (select public.is_workspace_admin(public.workspace_do_caminho(name)))
  )
  with check (
    bucket_id = 'logos'
    and (select public.is_workspace_admin(public.workspace_do_caminho(name)))
  );

drop policy if exists "logos_delete" on storage.objects;
create policy "logos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (select public.is_workspace_admin(public.workspace_do_caminho(name)))
  );

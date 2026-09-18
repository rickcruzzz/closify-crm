-- Velo Funil, a foto de perfil de quem escreve pelo WhatsApp
--
-- Pedido do dono: mostrar a foto da pessoa na caixa de entrada, no lugar das
-- iniciais. Hoje o avatar desenha duas letras, e numa lista de conversas a
-- foto e o que faz reconhecer de relance.
--
-- ============================================================================
-- Por que isto exige banco, e nao so tela
-- ============================================================================
--
-- Tres coisas medidas em 18/09 contra a API real fecham as saidas mais baratas:
--
--   1. A URL da foto EXPIRA. O parametro `oe` da Z-API carrega a validade, e
--      a que medimos morria em DEZ dias. Guardar a URL no banco produz um
--      avatar que some sozinho, sem nada falhar.
--
--   2. `pps.whatsapp.net` NAO esta no `img-src` da CSP, e a CSP deste projeto
--      e header de PRODUCAO em modo bloqueio, nao report-only. Uma tag `<img>`
--      apontando para la nao renderiza **e nao da erro na tela**. E a classe
--      que ja custou tres vezes aqui: a logo do Storage em 31/08, o script do
--      Google Ads em 04/09 e o robots.txt do Cloudflare em 03/09.
--
--   3. O Supabase Storage JA esta no `img-src`. Guardar a nossa propria copia
--      resolve os dois de uma vez: nao expira, e nao pede mudanca de CSP.
--
-- ============================================================================
-- 1. Bucket proprio, e nao o `logos`
-- ============================================================================
--
-- Poderia reaproveitar o bucket que existe, e nao deve. Sao coisas diferentes
-- em tudo que importa para seguranca:
--
--   logos      imagem DA EMPRESA, enviada por um admin, escrita pelo cliente
--   avatares   imagem de um TERCEIRO, baixada pelo servidor, e essa pessoa
--              nunca concordou com nada conosco: ela escreveu para a
--              marcenaria, nao para o Velo Funil
--
-- Misturar os dois faria a policy de escrita de um valer para o outro, e a de
-- `logos` permite escrita de admin. Aqui nenhum usuario escreve.
--
-- Privado, pelo mesmo motivo do `logos`: bucket publico serve o arquivo a quem
-- souber a URL, e a URL contem o id do workspace, que aparece em resposta de
-- API para qualquer membro.
--
-- 512 KB e nao 2 MB: foto de perfil do WhatsApp e miniatura. A que medimos
-- tinha 30 KB. O teto e a segunda linha de defesa, e quem confere os bytes de
-- verdade e o servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  false,
  524288, -- 512 KB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ============================================================================
-- 2. Ler e de membro. Escrever nao e de NINGUEM
-- ============================================================================
--
-- `workspace_do_caminho` ja existe desde a 0031 e resolve o primeiro segmento
-- do caminho como uuid, devolvendo `null` para caminho torto. Reusada aqui em
-- vez de uma segunda copia, que e a classe 7 do diagnostico de 25/08.
--
-- **Nao existe policy de insert, update nem delete para `authenticated`**, e a
-- ausencia e a decisao. A foto nasce de uma busca do SERVIDOR ao provedor; ela
-- nunca vem de upload de usuario. Sem policy de escrita nao ha o que forjar:
-- ninguem poe imagem na pasta de empresa nenhuma, nem na propria.
--
-- Quem escreve e `service_role`, que ignora RLS. Mesmo desenho de `error_logs`
-- e de `whatsapp_webhook_events`.

drop policy if exists "avatares_select" on storage.objects;
create policy "avatares_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatares'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

-- ============================================================================
-- 3. Duas colunas, e a segunda existe para o cron nao girar para sempre
-- ============================================================================
--
-- `foto_path` nulo quer dizer "nao temos foto". Sozinho, ele nao distingue
-- **"ainda nao buscamos"** de **"buscamos e essa pessoa nao tem foto"** — e
-- nao ter foto e comum, porque o WhatsApp deixa esconder a imagem de quem nao
-- e contato.
--
-- Sem a segunda coluna, a varredura pediria a mesma foto inexistente a cada
-- passagem, para sempre, gastando uma chamada ao provedor por contato por
-- rodada. E o mesmo raciocinio de `vigia_ultimo_aviso` (0062) e de
-- `sem_max_desde` (0091): guardar o FATO OBSERVADO em vez de derivar depois.
--
-- As duas sao anulaveis e sem default, entao nenhuma linha existente e tocada
-- e nenhuma escrita atual precisa mudar.

alter table public.leads
  add column if not exists foto_path text,
  add column if not exists foto_verificada_em timestamptz;

comment on column public.leads.foto_path is
  'Caminho da foto no bucket `avatares`, no formato {workspace_id}/{lead_id}.jpg. Nulo quer dizer que nao temos foto guardada.';

comment on column public.leads.foto_verificada_em is
  'Quando o provedor foi consultado pela ultima vez. Existe para a varredura nao repetir a busca de quem nao tem foto.';

-- O indice que a varredura usa: quem nunca foi verificado vem primeiro, e o
-- parcial mantem o indice pequeno porque a maior parte dos contatos sai da
-- fila depois da primeira passagem.
create index if not exists leads_foto_pendente_idx
  on public.leads (created_at)
  where foto_verificada_em is null;

-- ============================================================================
-- 4. O que NAO entra, e por que
-- ============================================================================
--
-- **Purga propria.** A foto e apagada junto com o lead, porque o caminho vive
-- dentro da pasta do workspace e a exclusao de conta ja limpa o Storage do
-- workspace. Um cron proprio de purga seria mais uma entrada para falhar em
-- silencio, e a decisao de 17/09 sobre a purga de instancia registra por que
-- se prefere pendurar no que ja roda.
--
-- **Coluna de URL assinada.** URL assinada tem validade curta de proposito, e
-- guardar uma no banco seria guardar algo que nasce vencido. Ela e gerada na
-- leitura, como `lib/workspace/empresa.ts` ja faz para a logo.

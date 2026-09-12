-- O opt-out passa a valer para o canal que de fato existe: o WhatsApp.
--
-- ## O defeito, e ele é pior do que a auditoria de 12/09 escreveu
--
-- `docs/VELO_HANDOFF_AUDIT.md` registrou que o disparo não lê esta tabela, o
-- que sugere que bastaria mandá-lo ler. **Não bastaria — os dois lados não
-- têm um campo em comum:**
--
--     descadastro_de_prospeccao   a chave e `email_hash`, sha256 de um token
--                                 que por sua vez e sha256 de "tempero:email"
--     a fila do disparo           casa por DOMINIO e por TELEFONE
--     a coluna `dominio`          existe desde a 0080 e NUNCA foi escrita —
--                                 `/nao-quero` grava so `email_hash`, porque
--                                 o token nao e reversivel e a pagina nao
--                                 sabe de quem ele e
--
-- Ou seja: uma leitura acrescentada ao disparo filtraria zero linhas para
-- sempre, e o alarme ficaria calado parecendo resolvido — que é a classe de
-- defeito mais cara deste projeto.
--
-- ## E o canal que a tabela atende nunca foi usado
--
-- Medido em 12/09: `tokenDeSaida()` não tem um único chamador fora do próprio
-- teste. O e-mail frio nunca saiu, nenhum link de saída jamais existiu, e esta
-- tabela tem zero linhas. O opt-out que de fato precisa funcionar chega por
-- WhatsApp — alguém respondendo *"não quero"* à abordagem —, e para esse não
-- havia nem coluna.
--
-- Enquanto isso a primeira mensagem promete, em texto: *"me avisa que não te
-- procuro de novo"*. A promessa dependia de o dono abrir `nao-perturbe.txt` e
-- digitar o domínio à mão — arquivo que, medido no mesmo dia, tem **zero
-- linhas**. Com 200 disparos por dia ela quebra sozinha, e segunda abordagem
-- depois de um "não" é o primeiro item da lista do que derruba um número em
-- `docs/mercado/limites-e-bloqueios.md`.
--
-- ## O desenho: UMA chave, que carrega o canal no próprio valor
--
-- A alternativa óbvia era três colunas anuláveis (`email_hash`,
-- `telefone_ultimos8`, `dominio`) com um índice único parcial em cada. Ela
-- quebra o `upsert`: `on conflict` sobre índice PARCIAL exige repetir o
-- predicado (`... where email_hash is not null`), e o PostgREST não tem como
-- expressar isso em `onConflict=`. O resultado seria uma página de descadastro
-- que falha no segundo clique — justamente o caso comum.
--
--     chave    'email:<sha256>' | 'fone:<8 digitos>' | 'dominio:<host>'
--
-- Uma coluna, um `unique` comum, um alvo de conflito que sempre funciona. O
-- prefixo é montado por `chaveDeDescadastro()` em `lib/prospeccao/opt-out.ts`,
-- e é ele a única regra — escrever o prefixo à mão em dois lugares seria a
-- segunda cópia que diverge em silêncio.
--
-- ## `dominio` continua coluna, e é ela que bloqueia a empresa
--
-- Quem responde "não quero" pelo WhatsApp gera uma linha com `chave` de
-- telefone **e** `dominio` preenchido quando a prospecção sabe de quem é. As
-- duas valem: o telefone barra aquele número, o domínio barra a empresa
-- inteira — inclusive um segundo site do mesmo dono, que é caso real medido em
-- 12/09 (`i9 Acrílicos` e `Fachadas Curitiba` compartilham telefone).
--
-- `dominio` NÃO ganha `unique`: a mesma empresa pode pedir para sair por
-- e-mail e por WhatsApp, e são dois pedidos de verdade. Duplicata aqui não
-- custa nada — quem lê faz `OR` sobre tudo.
--
-- ## Últimos 8 dígitos, e não o número inteiro
--
-- Mesma convenção de `encontrar_lead_por_telefone` e do índice
-- `leads_telefone_ultimos8_idx` (0047), pelo mesmo motivo escrito lá: o número
-- chega com DDI pelo WhatsApp e foi digitado em qualquer formato no CSV. Duas
-- regras de telefone no mesmo projeto divergiriam, e a que diverge em silêncio
-- deixaria passar quem pediu para sair.
--
-- ## A RLS não muda: ligada, zero policy
--
-- `service_role` escreve (a rota `/nao-quero` e o webhook) e `service_role` lê
-- (o disparo). O motivo de não haver policy de leitura é o da 0080 e continua
-- valendo: a chave pública está no HTML por design, e uma lista de empresas
-- prospectadas legível por qualquer visitante seria um vazamento criado para
-- atender à LGPD.

-- ---------------------------------------------------------------------------
-- 1. A chave única, com os dados que existirem migrados para ela
-- ---------------------------------------------------------------------------

alter table public.descadastro_de_prospeccao
  add column if not exists chave text;

-- A tabela está vazia hoje (medido em 12/09), então isto não move nada. Existe
-- para a migration ser correta se alguém clicar no link entre escrever e
-- aplicar — e porque `drop column` sem migrar antes é como se perde dado sem
-- ninguém notar.
update public.descadastro_de_prospeccao
   set chave = 'email:' || email_hash
 where chave is null
   and email_hash is not null;

-- Linha sem nenhum identificador não deveria existir; se existir, ela não
-- responde pergunta nenhuma e não pode virar `not null`.
delete from public.descadastro_de_prospeccao where chave is null;

alter table public.descadastro_de_prospeccao
  alter column chave set not null;

-- O `unique` da 0080 era sobre `email_hash`. Sai junto com a coluna.
alter table public.descadastro_de_prospeccao
  drop constraint if exists descadastro_de_prospeccao_email_hash_key;

alter table public.descadastro_de_prospeccao
  drop column if exists email_hash;

alter table public.descadastro_de_prospeccao
  add constraint descadastro_de_prospeccao_chave_key unique (chave);

-- ---------------------------------------------------------------------------
-- 2. O telefone, para o disparo do WhatsApp ter o que consultar
-- ---------------------------------------------------------------------------

alter table public.descadastro_de_prospeccao
  add column if not exists telefone_ultimos8 text;

-- O disparo pergunta "este número pediu para sair?" a cada rodada. Sem índice
-- isso é varredura sequencial por mensagem.
create index if not exists descadastro_de_prospeccao_telefone_idx
  on public.descadastro_de_prospeccao (telefone_ultimos8)
  where telefone_ultimos8 is not null;

-- Oito dígitos, ou nada. Um número com máscara entrando aqui nunca casaria com
-- o lado do disparo, e o pedido de saída morreria em silêncio.
alter table public.descadastro_de_prospeccao
  drop constraint if exists descadastro_de_prospeccao_telefone_formato;
alter table public.descadastro_de_prospeccao
  add constraint descadastro_de_prospeccao_telefone_formato
  check (telefone_ultimos8 is null or telefone_ultimos8 ~ '^[0-9]{8}$');

comment on column public.descadastro_de_prospeccao.telefone_ultimos8 is
  'Ultimos 8 digitos, mesma convencao de encontrar_lead_por_telefone (0047). UMA regra de telefone no projeto.';

comment on column public.descadastro_de_prospeccao.chave is
  'A identidade da linha: email:<sha256> | fone:<8 digitos> | dominio:<host>. Montada por chaveDeDescadastro() em lib/prospeccao/opt-out.ts.';

comment on table public.descadastro_de_prospeccao is
  'Quem pediu para nao receber prospeccao, por QUALQUER canal. Escrita por /nao-quero e pelo webhook da Evolution com service_role; lida pelo disparo antes de montar a fila. RLS ligada e sem policy de proposito.';

-- O registro de quem pediu para não receber e-mail de prospecção.
--
-- ## Por que isto é tabela, quando `nao-perturbe.txt` é arquivo
--
-- `lib/dono/silenciados.ts` deixou escrita a regra que eu segui até aqui:
-- *"criar tabela e migration para guardar 'não quero ver isso' acopla uma
-- decisão pessoal ao schema que os clientes usam"*. Ela continua certa, e este
-- caso é o contrário dela por dois motivos concretos.
--
-- **Quem escreve aqui é um estranho, em produção.** O `nao-perturbe.txt` é
-- lido por um script na máquina do dono; o link de saída do e-mail é clicado
-- por quem recebeu, na Vercel, que não tem disco. Não existe versão em arquivo
-- disso.
--
-- **E é obrigação legal, não preferência.** O e-mail frio B2B se sustenta em
-- interesse legítimo (Art. 7º, IX), e a base legal exige oposição fácil
-- (Art. 18, § 2º). Um pedido de descadastro precisa sobreviver a deploy, a
-- troca de máquina e a auditoria — que é exatamente o que arquivo local não
-- faz.
--
-- ## RLS ligada e ZERO policy, como `error_logs` e `asaas_webhook_events`
--
-- Ninguém autenticado lê nem escreve. Quem grava é a rota de saída com
-- `service_role`, e quem lê é o disparador antes de montar a fila.
--
-- O motivo de não haver policy de leitura é o mesmo de `error_logs`: a chave
-- pública está no HTML por design, e uma lista de e-mails de empresas
-- prospectadas legível por qualquer visitante seria um vazamento de dado
-- pessoal criado para atender a LGPD — o oposto do que esta tabela existe para
-- fazer.
--
-- ## O e-mail é guardado em HASH, não em texto
--
-- Guardar `ana@empresa.com.br` legível transformaria a lista de descadastro
-- numa lista de e-mails válidos — o ativo mais valioso para quem invadisse. O
-- disparador confere por hash, que responde "este endereço pediu para sair?"
-- sem que a tabela saiba quais endereços existem.
--
-- `sha256` do endereço normalizado (minúsculo, sem espaço). Não é segredo
-- criptográfico e não precisa ser: o objetivo é não publicar a lista, não
-- resistir a força bruta sobre um domínio conhecido.

create table public.descadastro_de_prospeccao (
  id uuid primary key default gen_random_uuid(),
  -- sha256 do e-mail normalizado, em hexadecimal.
  email_hash text not null unique,
  -- Domínio em texto claro: ele não identifica pessoa e é o que permite
  -- responder "esta empresa pediu para sair" sem reverter o hash.
  dominio text,
  -- De onde veio o pedido: 'link' (clicou), 'resposta' (respondeu pedindo),
  -- 'bounce' (a caixa não existe), 'manual'.
  origem text not null default 'link',
  created_at timestamptz not null default now()
);

alter table public.descadastro_de_prospeccao enable row level security;

create index descadastro_de_prospeccao_dominio_idx
  on public.descadastro_de_prospeccao (dominio);

comment on table public.descadastro_de_prospeccao is
  'Quem pediu para não receber prospecção. Escrita pela rota /nao-quero com service_role; lida pelo disparador. RLS ligada e sem policy de propósito.';

-- Põe a parede do Pro no momento em que a pessoa SENTE o valor.
--
-- ## O problema não era o limite, era ONDE ele estava
--
-- Até aqui as paredes do Pro eram 50 contatos (0052), 2 colaboradores e o PDF
-- do orçamento (0076). As três são limite ARBITRÁRIO no sentido técnico, e o
-- efeito disso é medido em conversão de freemium:
--
--     paywall no momento em que a pessoa SENTE o valor    8-12% convertem
--     paywall em limite arbitrario                        3-4% convertem
--
-- O de 50 contatos era o pior: quem importa a planilha chega com 20 e leva
-- meses para encostar nele, ou nunca encosta. O resultado está registrado no
-- `docs/estado-atual.md` desde 08/09 — **ninguém nunca experimentava o Pro**,
-- e os 8 workspaces em `plan = 'pro'` eram concessão manual do dono.
--
-- ## Por que o orçamento é o lugar certo
--
-- O momento "ahá" deste produto é nomeável numa frase: *o sistema me lembrou
-- do orçamento e eu fechei a venda*. É o que 88% do mercado chama de automação
-- e o que 0 de 25 geradores de orçamento fazem. Gatear ali põe a parede 3 a 7
-- dias dentro do uso ativo — que é onde Calendly (1 agenda), HubSpot (1
-- assento) e Loom (5 minutos) põem as delas.
--
-- ## O que esta trigger NÃO faz, e é a metade que importa
--
-- Ela não desliga o lembrete. O Free continua avisando, sempre. Cortar o aviso
-- deixaria o produto sem o único diferencial justamente para quem ainda está
-- decidindo, e venderia uma coisa que o avaliador nunca viu funcionar. O que o
-- Pro compra é QUANTIDADE, não a existência do aviso.
--
-- ## Três decisões de contagem, e cada uma evita um defeito concreto
--
-- **Só conta orçamento ABERTO.** Negócio em `fechado_ganho`/`fechado_perdido`
-- libera a vaga: a cobrança já aconteceu ou já morreu, e continuar ocupando
-- vaga transformaria o limite num contador vitalício, que é de novo o defeito
-- dos 50 contatos.
--
-- **Só morde quando a validade NASCE.** Editar a data de um orçamento que já
-- existe não consome vaga nova — sem isso, uma empresa que passasse do teto
-- por concessão ficaria impedida de CORRIGIR o que já tem.
--
-- **`pro_vigente()` e nunca `workspaces.plan`.** A coluna é o último valor
-- gravado pelo webhook e não sabe que o período pago venceu (0027). Mesma
-- regra da 0052 e da 0078.
--
-- Nada é apagado: empresa Free que já tenha mais de três orçamentos abertos
-- continua com eles. A trava vale do próximo em diante.
--
-- O `limite_free` duplica `FREE_ORCAMENTO_LIMIT` de `lib/plans.ts`, do mesmo
-- jeito que a 0052 duplica `FREE_LEAD_LIMIT`: a mensagem boa nasce no
-- TypeScript, antes de tentar, e esta existe porque Server Action é endpoint
-- HTTP e regra que só vive lá não é regra.

create or replace function public.checar_limite_de_orcamentos()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_total int;
  limite_free constant int := 3;
begin
  -- Linha sem validade não é orçamento com lembrete. Sai antes de tudo, para
  -- que o caminho comum do Kanban (mover card, editar valor) não pague nada.
  if new.orcamento_validade is null then
    return new;
  end if;

  -- Já era um orçamento antes desta escrita: mudar a data, a descrição ou a
  -- etapa não consome vaga nova.
  if tg_op = 'UPDATE' and old.orcamento_validade is not null then
    return new;
  end if;

  if public.pro_vigente(new.workspace_id) then
    return new;
  end if;

  -- Mesma serialização por workspace da 0026: sem o lock, duas transações leem
  -- a mesma contagem e as duas passam.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  -- Em trigger BEFORE, a tabela ainda tem o estado ANTERIOR: no INSERT a linha
  -- não existe, e no UPDATE ela ainda está com `orcamento_validade` nula (só
  -- chegamos aqui quando ela era nula). A contagem já exclui a própria linha
  -- sem precisar de `id <> new.id`.
  select count(*) into v_total
    from public.deals
   where workspace_id = new.workspace_id
     and orcamento_validade is not null
     and stage not in ('fechado_ganho', 'fechado_perdido');

  if v_total >= limite_free then
    raise exception 'O plano Free acompanha % orçamentos ao mesmo tempo. Feche um negócio ou faça upgrade para o Pro para acompanhar quantos quiser.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists checar_limite_de_orcamentos on public.deals;

create trigger checar_limite_de_orcamentos
  before insert or update on public.deals
  for each row
  execute function public.checar_limite_de_orcamentos();

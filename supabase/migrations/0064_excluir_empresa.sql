-- Excluir a empresa, pelo próprio dono dela, de dentro do produto.
--
-- ## Por que uma RPC, e não um `delete` da Server Action
--
-- `workspaces` tem RLS **sem policy de DELETE**. Um `delete` direto pela
-- sessão do usuário seria negado em silêncio: o PostgREST devolve sucesso com
-- zero linhas afetadas, e a tela diria "empresa excluída" com a empresa
-- intacta. É a mesma razão pela qual `excluir_minha_conta` (0035) existe.
--
-- E a regra em si não pode viver só no TypeScript. Server Action é endpoint
-- HTTP, e quem chamar o PostgREST direto com a chave pública — que está no
-- HTML por design — pula a validação. Três defeitos deste projeto vieram
-- disso: autoupgrade para Pro (0019→0022), limite de leads contornável (0023)
-- e autoconvite (0024).
--
-- ## As quatro travas, e por que cada uma
--
--     so o CRIADOR          admin nao basta. Quem foi convidado como admin
--                           administra o dia a dia; apagar a empresa inteira,
--                           com o historico de todo mundo, e do dono
--     nunca a ULTIMA        sem isto a pessoa fica sem empresa nenhuma e o
--                           middleware a manda para o onboarding, onde ela
--                           cria outra do zero. Perda total sem aviso
--     sem assinatura viva   mesma regra de `excluir_minha_conta`: apagar sem
--                           cancelar deixa a cobranca correndo no Asaas
--     o nome CONFERIDO      no servidor, nao so no dialogo. Conferencia que
--                           mora no cliente e sugestao

create or replace function public.excluir_empresa(target_workspace_id uuid, nome_confirmado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quantas_empresas int;
  nome_real text;
  tem_assinatura boolean;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  -- Criador, não admin. `is_workspace_creator` existe desde a 0005 e é
  -- exatamente esta pergunta.
  if not public.is_workspace_creator(target_workspace_id) then
    raise exception 'Só quem criou a empresa pode excluí-la.';
  end if;

  select name into nome_real from public.workspaces where id = target_workspace_id;
  if nome_real is null then
    raise exception 'Empresa não encontrada.';
  end if;

  -- O nome é conferido AQUI, e não só no diálogo. `btrim` porque copiar e
  -- colar traz espaço, e recusar por um espaço invisível seria cruel num
  -- campo que a pessoa preencheu justamente para ter certeza.
  if btrim(nome_confirmado) is distinct from btrim(nome_real) then
    raise exception 'O nome digitado não confere com o da empresa.';
  end if;

  -- Quantas empresas esta pessoa criou. A última não sai: sem empresa
  -- nenhuma, o middleware manda para o onboarding e ela recomeça do zero
  -- achando que perdeu tudo — o que, em termos práticos, aconteceu.
  select count(*) into quantas_empresas
  from public.workspace_members m
  where m.user_id = auth.uid() and m.role = 'admin';

  if quantas_empresas <= 1 then
    raise exception 'Esta é sua única empresa. Para sair de vez, exclua a conta em Perfil.';
  end if;

  -- Assinatura viva impede, pela mesma razão de `excluir_minha_conta`: o
  -- Asaas continua cobrando de uma empresa que não existe mais aqui, e o
  -- estorno vira conversa de suporte.
  select exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.status in ('active', 'trialing')
  ) into tem_assinatura;

  if tem_assinatura then
    raise exception 'Cancele a assinatura desta empresa antes de excluí-la.';
  end if;

  -- O `delete` leva contatos, negócios, atividades, tarefas, convites e
  -- membros por foreign key em cascata — as FKs já são `on delete cascade`
  -- desde a 0001. Não há limpeza manual a fazer, e escrevê-la aqui criaria
  -- uma segunda verdade sobre o que pertence a uma empresa.
  delete from public.workspaces where id = target_workspace_id;
end;
$$;

comment on function public.excluir_empresa is
  'Exclui uma empresa e tudo dentro dela. Só o criador, nunca a última, e nunca com assinatura viva.';

-- `anon` não tem sessão, e sem `auth.uid()` a função já recusaria — mas
-- revogar é a trava, não a expectativa.
revoke all on function public.excluir_empresa(uuid, text) from public, anon;
grant execute on function public.excluir_empresa(uuid, text) to authenticated;

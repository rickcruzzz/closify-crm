-- Seed de dados de teste — Closify CRM
-- Execute DEPOIS de 0001_core_schema.sql e depois de já existir pelo menos
-- um usuário em auth.users (crie uma conta via login/cadastro real antes).

do $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;
  v_lead_pulso uuid;
  v_lead_construforte uuid;
begin
  select id into v_owner_id from auth.users order by created_at asc limit 1;

  if v_owner_id is null then
    raise exception 'Nenhum usuário encontrado em auth.users — crie uma conta antes de rodar o seed.';
  end if;

  insert into public.workspaces (name, plan)
  values ('Agência Nova Era', 'pro')
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_owner_id, 'admin');

  insert into public.leads (workspace_id, owner_id, name, email, phone, company, status, value)
  values (v_workspace_id, v_owner_id, 'Rick Cruz', 'rick@agenciapulso.com', '11999990001', 'Agência Pulso', 'proposta_enviada', 7400)
  returning id into v_lead_pulso;

  insert into public.leads (workspace_id, owner_id, name, email, phone, company, status, value)
  values (v_workspace_id, v_owner_id, 'Ana Paula', 'ana@construforte.com', '11999990002', 'Construforte Engenharia', 'novo', 22000)
  returning id into v_lead_construforte;

  insert into public.deals (workspace_id, lead_id, owner_id, title, value, stage, due_date)
  values
    (v_workspace_id, v_lead_pulso, v_owner_id, 'Automação de atendimento — Agência Pulso', 7400, 'proposta_enviada', current_date + 5),
    (v_workspace_id, v_lead_construforte, v_owner_id, 'Pacote trimestral — Construforte Engenharia', 22000, 'novo', current_date - 3);

  insert into public.activities (workspace_id, lead_id, author_id, type, description)
  values
    (v_workspace_id, v_lead_pulso, v_owner_id, 'ligacao', 'Primeira ligação de qualificação.'),
    (v_workspace_id, v_lead_pulso, v_owner_id, 'email', 'Envio de proposta comercial.');

  insert into public.subscriptions (workspace_id, status)
  values (v_workspace_id, 'active');
end $$;

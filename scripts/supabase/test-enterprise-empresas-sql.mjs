// Prova em PostgreSQL temporário; não escreve em produção nem envia mensagens.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(new URL('../../../.tools/sql-proof/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href)
const db = new PGlite()
const arquivo = (nome) => readFile(new URL('../../supabase/migrations/' + nome, import.meta.url), 'utf8')
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let checks = 0
async function check(nome, fn) { await fn(); checks++; console.log(`PASS ${nome}`) }
async function scalar(sql, params = []) { return Object.values((await db.query(sql, params)).rows[0])[0] }
async function usuario(n) { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']) }
async function membro(n, empresa, papel = 'membro') {
  await db.query('insert into workspace_members values($1,$2,$3)', [empresa, id(n), papel])
}
async function empresa(n, dono) {
  await db.query('insert into workspaces(id,name,created_by) values($1,$2,$3)', [id(n), `Empresa ${n}`, id(dono)])
  await membro(dono, id(n), 'admin')
}
async function direitos(empresaId) {
  return (await db.query('select enterprise_vigente($1) as enterprise,pro_vigente($1) as pro,max_vigente($1) as max', [empresaId])).rows[0]
}
const sim = { enterprise: true, pro: true, max: true }
const nao = { enterprise: false, pro: false, max: false }
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create type workspace_role as enum('admin','membro');
    create type workspace_invite_status as enum('pending','accepted','expired');
    create table workspaces(id uuid primary key default gen_random_uuid(),name text,created_by uuid,
      plan text default 'free',trial_ate timestamptz,created_at timestamptz default now());
    create table workspace_members(workspace_id uuid references workspaces(id),user_id uuid references auth.users(id),role workspace_role,primary key(workspace_id,user_id));
    create table workspace_invites(id uuid default gen_random_uuid(),workspace_id uuid references workspaces(id),
      email text,token uuid unique default gen_random_uuid(),role workspace_role default 'membro',
      status workspace_invite_status default 'pending',expires_at timestamptz default now()+interval '7 days');
    create unique index convites_pendentes on workspace_invites(workspace_id,email) where status='pending';
    create table subscriptions(workspace_id uuid,status text,current_period_end timestamptz,ultimo_billing_type text,plano text);
    create function dias_de_graca(text) returns int language sql as $$select 0$$;
    create function em_trial(uuid) returns boolean language sql as $$select false$$;
    create function is_workspace_member(target_workspace_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
      select exists(select 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=auth.uid())$$;
    create function is_workspace_admin(target_workspace_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
      select exists(select 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=auth.uid() and role='admin')$$;
  `)
  await db.exec(await arquivo('0100_enterprise_eventos.sql'))
  await db.exec(await arquivo('0057_empresa_nova_nasce_no_free.sql'))
  await db.exec(await arquivo('0094_o_max_cria_ate_dez_empresas.sql'))
  await db.exec(await arquivo('20261022135807_enterprise_cinco_colaboradores_email_confirmado.sql'))
  await db.exec(`create trigger validar_convite_de_workspace before insert on workspace_invites for each row execute function validar_convite_de_workspace()`)
  for (let n = 1; n <= 20; n++) {
    await db.query('insert into auth.users values($1,$2,$3)', [id(n), `user${n}@example.test`, n === 9 ? null : new Date()])
  }
  await usuario(1)
  await empresa(100, 1)
  await db.query('insert into enterprise_workspaces(workspace_id) values($1)', [id(100)])
  await empresa(101, 1)
  await check('reproduz defeito: segunda empresa do titular não herda Enterprise', async () => {
    assert.deepEqual(await direitos(id(100)), sim)
    assert.deepEqual(await direitos(id(101)), nao)
  })
  const migration = await arquivo('20261022204856_enterprise_cinco_empresas_do_titular.sql')
  await db.exec(migration)
  await db.exec(migration)
  await check('migração idempotente corrige empresas já criadas sem mudar plano ou dados', async () => {
    assert.deepEqual(await direitos(id(100)), sim)
    assert.deepEqual(await direitos(id(101)), sim)
    assert.equal(await scalar("select count(*)::int from workspaces where plan='free'"), 2)
    assert.equal(await scalar('select count(*)::int from enterprise_workspaces'), 1)
  })
  const empresas = [id(100), id(101)]
  await check('terceira, quarta e quinta herdam Enterprise pelos dois nomes RPC', async () => {
    for (const fn of ['create_workspace_with_admin', 'criar_workspace_com_admin', 'create_workspace_with_admin']) {
      const nova = await scalar(`select ${fn}($1)`, ['Nova empresa'])
      empresas.push(nova)
      assert.deepEqual(await direitos(nova), sim)
    }
    assert.equal(empresas.length, 5)
  })
  await check('sexta bloqueada nas duas RPCs mesmo com direito Max herdado', async () => {
    for (const fn of ['create_workspace_with_admin', 'criar_workspace_com_admin']) {
      await assert.rejects(() => db.query(`select ${fn}($1)`, ['Sexta']), /Enterprise inclui até 5 empresas/)
    }
    assert.equal(await scalar('select count(*)::int from workspaces where created_by=$1', [id(1)]), 5)
  })
  await check('ambas RPCs compartilham a trava transacional por titular', async () => {
    assert.match(await scalar("select pg_get_functiondef('public.create_workspace_with_admin(text)'::regprocedure)"), /pg_advisory_xact_lock/)
    assert.match(await scalar("select pg_get_functiondef('public.criar_workspace_com_admin(text)'::regprocedure)"), /public.create_workspace_with_admin/)
  })
  await check('não autoriza anon nem expõe concessão/helper ou enumeração ao navegador', async () => {
    assert.equal(await scalar("select has_function_privilege('anon','public.create_workspace_with_admin(text)','execute')"), false)
    assert.equal(await scalar("select has_function_privilege('authenticated','private.enterprise_cobre_empresa(uuid)','execute')"), false)
    assert.equal(await scalar("select has_function_privilege('authenticated','public.listar_empresas_enterprise_ativas()','execute')"), false)
    assert.equal(await scalar("select has_table_privilege('authenticated','enterprise_workspaces','insert')"), false)
    assert.equal(await scalar("select has_function_privilege('service_role','public.listar_empresas_enterprise_ativas()','execute')"), true)
    assert.equal(await scalar('select count(*)::int from listar_empresas_enterprise_ativas()'), 5)
  })
  await check('cinco colaboradores continuam sendo o teto na empresa herdada', async () => {
    for (let n = 2; n <= 6; n++) await membro(n, id(101))
    await assert.rejects(() => membro(7, id(101)), /até 5 colaboradores/)
    await usuario(2)
    assert.deepEqual(await direitos(id(101)), sim)
    assert.equal(await scalar('select enterprise_vigente($1)', [empresas[2]]), false)
    await usuario(1)
  })
  await check('confirmação de e-mail e reservas se aplicam às empresas herdadas', async () => {
    await assert.rejects(() => membro(9, empresas[2]), /e-mail confirmado/)
    for (let n = 10; n <= 14; n++) {
      await db.query('insert into workspace_invites(workspace_id,email) values($1,$2)', [empresas[2], `user${n}@example.test`])
    }
    await assert.rejects(() => membro(7, empresas[2]), /até 5 colaboradores/)
    await assert.rejects(() => db.query('insert into workspace_invites(workspace_id,email) values($1,$2)', [empresas[2], 'user15@example.test']), /até 5 colaboradores/)
  })
  await check('convite como admin não dá Enterprise às empresas do convidado', async () => {
    await empresa(200, 8)
    await membro(8, id(100), 'admin')
    await usuario(8)
    assert.deepEqual(await direitos(id(100)), sim)
    assert.deepEqual(await direitos(id(200)), nao)
    await assert.rejects(() => db.query("select create_workspace_with_admin('Outra')"), /Free inclui 1 empresa/)
    await usuario(1)
  })
  await check('empresa excedente preexistente é preservada, sem ganhar Enterprise', async () => {
    await db.query('insert into workspaces(id,name,created_by,created_at) values($1,$2,$3,now()+interval \'1 day\')', [id(102), 'Excedente', id(1)])
    assert.equal(await scalar('select private.enterprise_cobre_empresa($1)', [id(102)]), false)
    assert.equal(await scalar('select count(*)::int from workspaces'), 7)
    assert.equal(await scalar('select count(*)::int from listar_empresas_enterprise_ativas()'), 5)
  })
  await check('revogação da concessão remove herança sem apagar empresas', async () => {
    await db.exec('update enterprise_workspaces set active=false')
    for (const empresaId of empresas) assert.deepEqual(await direitos(empresaId), nao)
    assert.equal(await scalar('select count(*)::int from workspaces'), 7)
    await db.exec('update enterprise_workspaces set active=true')
  })
  await check('rollback restaura regras sem remover empresas, membros ou convites', async () => {
    const antes = await scalar('select count(*)::int from workspace_members')
    await db.exec(await readFile(new URL('./rollback-enterprise-cinco-empresas.sql', import.meta.url), 'utf8'))
    assert.deepEqual(await direitos(id(101)), nao)
    assert.equal(await scalar('select count(*)::int from workspace_members'), antes)
    assert.equal(await scalar('select count(*)::int from workspace_invites'), 5)
    assert.equal(await scalar('select count(*)::int from workspaces'), 7)
  })
  console.log(`${checks}/${checks} verificações SQL passaram em PostgreSQL temporário.`)
} finally { await db.close() }
